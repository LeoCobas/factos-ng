import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Arca, AuthRepository } from 'npm:@arcasdk/core@0.3.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    return this.dbTicket;
  }

  async save(_cuit: number, credentials: any): Promise<void> {
    await this.supabaseClient
      .from('contribuyentes')
      .update({ arca_ticket: credentials })
      .eq('user_id', this.userId);
  }
}

type FiscalProfile =
  | 'responsable-inscripto'
  | 'monotributo'
  | 'exento'
  | 'no-inscripto'
  | 'no-alcanzado'
  | 'sin-datos'
  | 'ambiguo';

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

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> => item != null && typeof item === 'object'
    );
  }

  if (value && typeof value === 'object') {
    return [value as Record<string, unknown>];
  }

  return [];
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

function getTaxEntries(source: Record<string, unknown>): Record<string, unknown>[] {
  return [...asArray(source.impuesto), ...asArray(source.impuestos)];
}

function normalizeTaxState(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'ACTIVO') return 'AC';
  if (normalized === 'EXENTO') return 'EX';
  return normalized;
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

function resolveFiscalProfile(persona: Record<string, unknown>): {
  condicionIva: string;
  fiscalProfile: FiscalProfile;
  reliable: boolean;
  message: string;
} {
  const datosMonotributo = getNestedRecord(persona, 'datosMonotributo');
  const datosRegimenGeneral = getNestedRecord(persona, 'datosRegimenGeneral');
  const monotributoTaxes = getTaxEntries(datosMonotributo);
  const regimenGeneralTaxes = getTaxEntries(datosRegimenGeneral);
  const monotributoCategory = asArray(datosMonotributo.categoriaMonotributo);

  const monotributoActive =
    monotributoCategory.length > 0 ||
    monotributoTaxes.some((tax) => {
      const descripcion = normalizeText(tax.descripcionImpuesto);
      const estado = normalizeTaxState(tax.estadoImpuesto ?? tax.estado);
      return descripcion.includes('monotributo') && estado === 'AC';
    });

  const ivaTax =
    regimenGeneralTaxes.find((tax) => normalizeText(tax.descripcionImpuesto) === 'iva') ||
    regimenGeneralTaxes.find((tax) =>
      normalizeText(tax.descripcionImpuesto).includes('impuesto al valor agregado')
    );

  const ivaState = normalizeTaxState(ivaTax?.estadoImpuesto ?? ivaTax?.estado);

  if (monotributoActive && ivaState === 'AC') {
    return {
      condicionIva: 'No categorizado',
      fiscalProfile: 'ambiguo',
      reliable: false,
      message: 'La constancia informa Monotributo e IVA activos al mismo tiempo.',
    };
  }

  if (monotributoActive) {
    return {
      condicionIva: 'Responsable Monotributo',
      fiscalProfile: 'monotributo',
      reliable: true,
      message: 'Condicion fiscal verificada por constancia de inscripcion.',
    };
  }

  switch (ivaState) {
    case 'AC':
      return {
        condicionIva: 'IVA Responsable Inscripto',
        fiscalProfile: 'responsable-inscripto',
        reliable: true,
        message: 'Condicion fiscal verificada por constancia de inscripcion.',
      };
    case 'EX':
      return {
        condicionIva: 'Exento',
        fiscalProfile: 'exento',
        reliable: true,
        message: 'Constancia con IVA exento.',
      };
    case 'NI':
      return {
        condicionIva: 'No Inscripto',
        fiscalProfile: 'no-inscripto',
        reliable: true,
        message: 'La constancia indica que el cliente no esta inscripto en IVA.',
      };
    case 'NA':
    case 'XN':
    case 'AN':
      return {
        condicionIva: 'No Alcanzado',
        fiscalProfile: 'no-alcanzado',
        reliable: true,
        message: 'La constancia indica que el cliente no esta alcanzado por IVA.',
      };
    default:
      break;
  }

  const errorRegimenGeneral = getNestedRecord(persona, 'errorRegimenGeneral');
  const errorMonotributo = getNestedRecord(persona, 'errorMonotributo');
  const hint =
    getString(errorRegimenGeneral.error) ||
    getString(errorRegimenGeneral.mensaje) ||
    getString(errorMonotributo.error) ||
    getString(errorMonotributo.mensaje) ||
    'La constancia no devolvio impuestos suficientes para clasificar al cliente.';

  return {
    condicionIva: 'No categorizado',
    fiscalProfile: 'sin-datos',
    reliable: false,
    message: hint,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseClient(authHeader);
    const { cuit } = await req.json();

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
      const persona = await arca.registerInscriptionProofService.getTaxpayerDetails(
        parseInt(String(cuit), 10)
      );

      if (!persona) {
        return new Response(JSON.stringify({ success: false, error: 'CUIT no encontrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const personaObj = asRecord(persona);
      const lookupError = buildLookupError(personaObj);
      if (lookupError) {
        return new Response(JSON.stringify({ success: false, error: lookupError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const datosGenerales = getNestedRecord(personaObj, 'datosGenerales');
      const domicilioFiscal = getNestedRecord(datosGenerales, 'domicilioFiscal');
      const fiscalData = resolveFiscalProfile(personaObj);

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
      return new Response(JSON.stringify({ success: false, error: `AFIP: ${afipErr.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
