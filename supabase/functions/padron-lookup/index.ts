import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessTicket, Arca, MemoryTicketStorage } from 'npm:@arcasdk/core@2.0.0';
import { extractFiscalDataFromConstancia } from '../../../src/app/core/utils/constancia-inscripcion.util.ts';
import { SupabaseArcaTicketStorage } from '../_shared/arca-ticket-storage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARCA_TIMEOUT_MS = 15000;
function getArcaEnvironmentLabel(production: boolean): 'produccion' | 'homologacion' {
  return production ? 'produccion' : 'homologacion';
}

function getSupabaseClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  if (authHeader) {
    return createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No autorizado');

  const supabase = getSupabaseClient(authHeader);
  const token = authHeader.replace('Bearer ', '').trim();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error('Sesion invalida');
  return { supabase, user };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getString(value: unknown): string {
  return String(value || '').trim();
}

function getNestedRecord(
  source: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    const candidate = source[key];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return {};
}

function formatDomicilioFiscal(domicilioFiscal: Record<string, unknown>): string {
  const direccion = getString(domicilioFiscal.direccion);
  const datoAdicional = getString(domicilioFiscal.datoAdicional);
  const localidad = getString(domicilioFiscal.localidad);
  const provincia = getString(domicilioFiscal.descripcionProvincia);
  const codPostal = getString(domicilioFiscal.codPostal);

  return [direccion, datoAdicional, localidad, provincia, codPostal]
    .filter((part) => part.length > 0)
    .join(', ');
}

function extractRazonSocial(datosGenerales: Record<string, unknown>): string {
  return (
    getString(datosGenerales.razonSocial) ||
    [getString(datosGenerales.apellido), getString(datosGenerales.nombre)]
      .filter(Boolean)
      .join(' ')
      .trim()
  );
}

function buildLookupError(persona: Record<string, unknown>): string | null {
  const errorConstancia = getNestedRecord(persona, 'errorConstancia');
  const errorMessage = getString(errorConstancia.error) || getString(errorConstancia.mensaje) || '';

  if (!errorMessage) {
    return null;
  }

  if (normalizeText(errorMessage).includes('no existe persona')) {
    return 'CUIT no encontrado';
  }

  return errorMessage;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchTaxpayerFromArca(
  arca: Arca,
  cuit: number,
): Promise<Record<string, unknown> | null> {
  const constanciaBatch = await withTimeout(
    arca.registerInscriptionProofService.getTaxpayersDetails([cuit]),
    ARCA_TIMEOUT_MS,
    'Timeout consultando la constancia de inscripcion batch en ARCA.',
  );

  const batchRecord = asRecord(constanciaBatch);
  const personaEntries = Array.isArray(batchRecord['persona']) ? batchRecord['persona'] : [];
  const persona = asRecord(personaEntries[0]);

  if (Object.keys(persona).length > 0) {
    return persona;
  }

  return null;
}

/**
 * Contrato operativo: consulta constancia de inscripcion para un CUIT usando el contribuyente autenticado.
 * La plataforma no valida JWT en gateway: la function exige Bearer token y valida sesion en codigo.
 * Requiere contribuyente existente, certificados cargados y bucket `padron` operativo.
 * Aun con `service_role`, la lectura se limita a las columnas estrictamente necesarias.
 * Devuelve una respuesta normalizada para frontend con razon social, domicilio y clasificacion fiscal.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    const { cuit } = await req.json();

    if (!cuit) throw new Error('CUIT requerido');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const db = serviceKey?.length ? createClient(supabaseUrl, serviceKey) : supabase;

    const { data: contribuyente, error: contribErr } = await db
      .from('contribuyentes')
      .select('cuit, arca_cert, arca_key, arca_production, arca_ticket')
      .eq('user_id', user.id)
      .maybeSingle();

    if (contribErr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo leer tu configuracion. Intenta de nuevo.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let cert = contribuyente?.arca_cert;
    let key = contribuyente?.arca_key;
    let cuitEmisor = contribuyente ? parseInt(contribuyente.cuit, 10) : null;
    let production = contribuyente?.arca_production === true;

    const isFallbackMode = !cert || !key || !cuitEmisor;
    if (isFallbackMode) {
      cert = Deno.env.get('SYSTEM_ARCA_CERT');
      key = Deno.env.get('SYSTEM_ARCA_KEY');
      const systemCuit = Deno.env.get('SYSTEM_ARCA_CUIT');
      cuitEmisor = systemCuit ? parseInt(systemCuit, 10) : null;
      production = Deno.env.get('SYSTEM_ARCA_PRODUCTION') === 'true';

      if (!cert || !key || !cuitEmisor) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Servidor no configurado para consultas de onboarding (faltan credenciales de sistema).',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const ticketStorage = isFallbackMode
      ? new MemoryTicketStorage({ cuit: cuitEmisor!, production })
      : new SupabaseArcaTicketStorage(
          supabase,
          'padron',
          contribuyente?.arca_ticket,
          AccessTicket,
        );
    const arca = new Arca({
      key: key!,
      cert: cert!,
      cuit: cuitEmisor!,
      production,
      ticketStorage,
      useHttpsAgent: false,
    });

    try {
      const normalizedCuit = parseInt(String(cuit), 10);
      const arcaEnvironment = getArcaEnvironmentLabel(production);

      let personaObj: Record<string, unknown> | null = null;
      personaObj = await fetchTaxpayerFromArca(arca, normalizedCuit);

      if (!personaObj) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `ARCA no devolvio datos para ese CUIT en ${arcaEnvironment}. Verifica la relacion del servicio y vuelve a intentar en unos minutos.`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const lookupError = buildLookupError(personaObj);
      if (lookupError) {
        return new Response(JSON.stringify({ success: false, error: lookupError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const datosGenerales = getNestedRecord(personaObj, 'datosGenerales');
      const domicilioFiscal = getNestedRecord(datosGenerales, 'domicilioFiscal');
      const fiscalData = extractFiscalDataFromConstancia(personaObj);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            razon_social: extractRazonSocial(datosGenerales),
            domicilio: formatDomicilioFiscal(domicilioFiscal) || 'No especificado en constancia',
            condicion_iva: fiscalData.condicionIva,
            fiscal_profile: fiscalData.fiscalProfile,
            fiscal_status_message: fiscalData.message,
            fiscal_status_reliable: fiscalData.reliable,
            fiscal_status_source: 'constancia_inscripcion',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (afipErr: any) {
      const message = String(afipErr?.message || 'Error desconocido');
      const normalizedMessage = normalizeText(message);

      const status =
        normalizedMessage.includes('timeout') || normalizedMessage.includes('timed out')
          ? 504
          : 200;

      return new Response(JSON.stringify({ success: false, error: `AFIP: ${message}` }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
