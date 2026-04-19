import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Arca, AuthRepository } from 'npm:@arcasdk/core@0.3.6';
import {
  readArcaTicketBucket,
  writeArcaTicketBucket,
} from '../../../src/app/core/utils/arca-ticket.util.ts';
import { extractFiscalDataFromConstancia } from '../../../src/app/core/utils/constancia-inscripcion.util.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARCA_TIMEOUT_MS = 15000;

interface DiagnosticCallResult {
  service: 'constancia_inscripcion' | 'padron_a13';
  ok: boolean;
  returnedNull: boolean;
  error: string | null;
  keys: string[];
  preview: Record<string, unknown> | null;
}

interface TicketDiagnosticResult {
  hasStoredTicket: boolean;
  expiresAt: string | null;
  destination: string | null;
  generationTime: string | null;
}

function getArcaEnvironmentLabel(production: boolean): 'produccion' | 'homologacion' {
  return production ? 'produccion' : 'homologacion';
}

class SupabaseAuthRepository implements AuthRepository {
  supabaseClient: any;
  userId: string;
  dbTicket: any;

  constructor(supabaseClient: any, userId: string, dbTicket: any) {
    this.supabaseClient = supabaseClient;
    this.userId = userId;
    this.dbTicket = dbTicket || null;
  }

  async get(_cuit: number): Promise<any | null> {
    return readArcaTicketBucket(this.dbTicket, 'padron');
  }

  async save(_cuit: number, credentials: any): Promise<void> {
    await this.supabaseClient
      .from('contribuyentes')
      .update({ arca_ticket: writeArcaTicketBucket(this.dbTicket, 'padron', credentials) })
      .eq('user_id', this.userId);
    this.dbTicket = writeArcaTicketBucket(this.dbTicket, 'padron', credentials);
  }
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
  const errorMessage =
    getString(errorConstancia.error) || getString(errorConstancia.mensaje) || '';

  if (!errorMessage) {
    return null;
  }

  if (normalizeText(errorMessage).includes('no existe persona')) {
    return 'CUIT no encontrado';
  }

  return errorMessage;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
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

function extractPreview(node: unknown): Record<string, unknown> | null {
  const record = asRecord(node);
  if (Object.keys(record).length === 0) {
    return null;
  }

  const datosGenerales = getNestedRecord(record, 'datosGenerales');
  const datosRegimenGeneral = getNestedRecord(record, 'datosRegimenGeneral');
  const datosMonotributo = getNestedRecord(record, 'datosMonotributo');

  return {
    topLevelKeys: Object.keys(record),
    razonSocial: getString(datosGenerales['razonSocial']),
    nombre: getString(datosGenerales['nombre']),
    apellido: getString(datosGenerales['apellido']),
    impuestosRg: datosRegimenGeneral['impuestos'] ?? datosRegimenGeneral['impuesto'] ?? null,
    impuestosMono: datosMonotributo['impuestos'] ?? datosMonotributo['impuesto'] ?? null,
    categoriaMono:
      datosMonotributo['categoriaMonotributo'] ?? datosMonotributo['categoria'] ?? null,
    errorConstancia: getNestedRecord(record, 'errorConstancia'),
    errorRegimenGeneral: getNestedRecord(record, 'errorRegimenGeneral'),
    errorMonotributo: getNestedRecord(record, 'errorMonotributo'),
  };
}

async function captureDiagnosticCall(
  service: DiagnosticCallResult['service'],
  fetcher: () => Promise<unknown>
): Promise<DiagnosticCallResult> {
  try {
    const result = await withTimeout(
      fetcher(),
      ARCA_TIMEOUT_MS,
      `Timeout consultando ${service} en ARCA.`
    );

    if (result == null) {
      return {
        service,
        ok: false,
        returnedNull: true,
        error: null,
        keys: [],
        preview: null,
      };
    }

    const record = asRecord(result);

    return {
      service,
      ok: true,
      returnedNull: false,
      error: null,
      keys: Object.keys(record),
      preview: extractPreview(record),
    };
  } catch (error) {
    return {
      service,
      ok: false,
      returnedNull: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      keys: [],
      preview: null,
    };
  }
}

function inspectStoredPadronTicket(rawTicket: unknown): TicketDiagnosticResult {
  const ticket = asRecord(rawTicket);
  const header = getNestedRecord(ticket, 'header');
  const credentials = getNestedRecord(ticket, 'credentials');

  return {
    hasStoredTicket: Object.keys(ticket).length > 0,
    expiresAt:
      getString(ticket['expirationTime']) ||
      getString(credentials['expirationTime']) ||
      getString(header['expirationTime']) ||
      null,
    destination:
      getString(ticket['destination']) ||
      getString(credentials['destination']) ||
      getString(header['destination']) ||
      null,
    generationTime:
      getString(ticket['generationTime']) ||
      getString(credentials['generationTime']) ||
      getString(header['generationTime']) ||
      null,
  };
}

async function fetchTaxpayerFromArca(arca: Arca, cuit: number): Promise<Record<string, unknown> | null> {
  const constancia = await withTimeout(
    arca.registerInscriptionProofService.getTaxpayerDetails(cuit),
    ARCA_TIMEOUT_MS,
    'Timeout consultando la constancia de inscripcion en ARCA.'
  );

  if (constancia && typeof constancia === 'object') {
    return asRecord(constancia);
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseClient(authHeader);
    const { cuit, debug } = await req.json();

    if (!cuit) throw new Error('CUIT requerido');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesion invalida');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const db = serviceKey?.length ? createClient(supabaseUrl, serviceKey) : supabase;

    const { data: contribuyente, error: contribErr } = await db
      .from('contribuyentes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (contribErr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo leer tu configuracion. Intenta de nuevo.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contribuyente) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'No tenes perfil de contribuyente. En Facturacion toca Guardar Datos de Facturacion al menos una vez y luego vuelve a buscar la constancia.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!String(contribuyente.arca_cert || '').trim() || !String(contribuyente.arca_key || '').trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Faltan el certificado (.crt) o la clave (.key). Guardalos en Certificado ARCA y toca Guardar antes de consultar la constancia.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arca = new Arca({
      key: contribuyente.arca_key,
      cert: contribuyente.arca_cert,
      cuit: parseInt(contribuyente.cuit, 10),
      production: contribuyente.arca_production === true,
      handleTicket: true,
      useHttpsAgent: false,
      authRepository: new SupabaseAuthRepository(supabase, user.id, contribuyente.arca_ticket),
    });

    try {
      const normalizedCuit = parseInt(String(cuit), 10);
      const arcaEnvironment = getArcaEnvironmentLabel(contribuyente.arca_production === true);

      if (debug === true) {
        const storedPadronTicket = readArcaTicketBucket(contribuyente.arca_ticket, 'padron');
        const [constanciaDiag, a13Diag, constanciaStatus] = await Promise.all([
          captureDiagnosticCall('constancia_inscripcion', () =>
            arca.registerInscriptionProofService.getTaxpayerDetails(normalizedCuit)
          ),
          captureDiagnosticCall('padron_a13', () =>
            arca.registerScopeThirteenService.getTaxpayerDetails(normalizedCuit)
          ),
          withTimeout(
            arca.registerInscriptionProofService.getServerStatus(),
            ARCA_TIMEOUT_MS,
            'Timeout consultando serverStatus de constancia_inscripcion.'
          ).catch((error) => ({
            error: error instanceof Error ? error.message : 'Error desconocido',
          })),
        ]);

        return new Response(
          JSON.stringify({
            success: true,
            debug: true,
            cuit: normalizedCuit,
            environment: arcaEnvironment,
            emisor_cuit: contribuyente.cuit,
            ticket: inspectStoredPadronTicket(storedPadronTicket),
            constancia_server_status: constanciaStatus,
            diagnostics: [constanciaDiag, a13Diag],
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const personaObj = await fetchTaxpayerFromArca(arca, normalizedCuit);

      if (!personaObj) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              `ARCA no devolvio datos para ese CUIT en ${arcaEnvironment}. Verifica la relacion del servicio y vuelve a intentar en unos minutos.`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
