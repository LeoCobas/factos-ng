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

function buildDomicilioString(dom: unknown): string {
  if (dom == null) return '';
  if (typeof dom === 'string') return dom.trim();
  if (typeof dom !== 'object') return '';

  const d = dom as Record<string, unknown>;
  const calleLine = [d.calle, d.numero, d.piso, d.dpto, d.sector, d.manzana]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join(' ')
    .trim();
  const linea1 = String(d.direccion || d.domicilio || calleLine || '').trim();
  const loc = String(
    d.localidad || d.localidadDescripcion || d.municipio || d.descripcionLocalidad || ''
  ).trim();
  const prov = String(d.descripcionProvincia || d.provincia || d.provinciaDescripcion || '').trim();
  const cp = String(d.codPostal || d.cp || d.codigoPostal || '').trim();
  const parts = [linea1, loc, prov, cp].filter((p) => p.length > 0);
  return parts.join(', ').trim();
}

function deepFindDomicilioEnDatosGenerales(node: unknown, depth: number): string {
  if (depth <= 0 || node == null) return '';

  const direct = buildDomicilioString(node);
  if (direct) return direct;
  if (typeof node !== 'object') return '';

  for (const value of Object.values(node)) {
    if (value != null && typeof value === 'object') {
      const found = deepFindDomicilioEnDatosGenerales(value, depth - 1);
      if (found) return found;
    }
  }

  return '';
}

function extractDomicilioFromPersona(persona: Record<string, unknown>): string {
  const dg = persona.datosGenerales as Record<string, unknown> | undefined;
  const candidates: unknown[] = [];

  const push = (value: unknown) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) candidates.push(item);
      return;
    }
    candidates.push(value);
  };

  if (dg) {
    push(dg.domicilio);
    push(dg.domicilioFiscal);
    push(dg.domicilioFiscalDeReferencia);
  }

  push(persona.domicilioFiscal);
  push(persona.domicilio);

  for (const candidate of candidates) {
    const built = buildDomicilioString(candidate);
    if (built) return built;
  }

  if (dg) {
    const deep = deepFindDomicilioEnDatosGenerales(dg, 8);
    if (deep) return deep;
  }

  return '';
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function collectNestedValues(node: unknown, maxDepth: number, acc: string[] = []): string[] {
  if (maxDepth < 0 || node == null) return acc;

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    acc.push(String(node));
    return acc;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectNestedValues(item, maxDepth - 1, acc);
    }
    return acc;
  }

  if (typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectNestedValues(value, maxDepth - 1, acc);
    }
  }

  return acc;
}

function hasNonEmptyCollection(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return false;
}

function inferCondicionIva(persona: Record<string, unknown>): string {
  const normalizedDump = normalizeText(collectNestedValues(persona, 6).join(' '));
  const hasMonotributoData =
    hasNonEmptyCollection(persona.datosMonotributo) ||
    hasNonEmptyCollection(persona.categoriasMonotributo) ||
    normalizedDump.includes('monotrib');
  const hasRegimenGeneralData =
    hasNonEmptyCollection(persona.datosRegimenGeneral) ||
    hasNonEmptyCollection(persona.impuestos) ||
    normalizedDump.includes('regimen general') ||
    normalizedDump.includes('responsable inscripto') ||
    normalizedDump.includes('iva activo') ||
    normalizedDump.includes('impuesto al valor agregado');

  if (hasMonotributoData) return 'Responsable Monotributo';
  if (normalizedDump.includes('exento')) return 'Exento';

  if (hasRegimenGeneralData) {
    return 'IVA Responsable Inscripto';
  }

  return 'No categorizado';
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
        JSON.stringify({ success: false, error: 'No se pudo leer tu configuracion. Intenta de nuevo.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contribuyente) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'No tenes perfil de contribuyente. En Facturacion toca Guardar Datos de Facturacion al menos una vez y luego vuelve a buscar en el padron.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!String(contribuyente.arca_cert || '').trim() || !String(contribuyente.arca_key || '').trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Faltan el certificado (.crt) o la clave (.key). Guardalos en Certificado ARCA y toca Guardar antes de buscar en el padron.',
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
      const persona = await arca.registerScopeThirteenService.getTaxpayerDetails(parseInt(String(cuit), 10));
      if (!persona) {
        return new Response(JSON.stringify({ success: false, error: 'CUIT no encontrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const personaObj = persona as Record<string, unknown>;
      const dg = personaObj.datosGenerales as Record<string, unknown> | undefined;
      const domicilioString = extractDomicilioFromPersona(personaObj);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            razon_social: dg?.razonSocial || `${dg?.apellido || ''} ${dg?.nombre || ''}`.trim(),
            domicilio: domicilioString || 'No especificado en padron',
            condicion_iva: inferCondicionIva(personaObj),
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
