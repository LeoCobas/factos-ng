import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Arca, AuthRepository } from "npm:@arcasdk/core@0.3.6";

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
  async get(cuit: number): Promise<any | null> { return this.dbTicket; }
  async save(cuit: number, credentials: any): Promise<void> {
    await this.supabaseClient.from('contribuyentes').update({ arca_ticket: credentials }).eq('user_id', this.userId);
  }
}

function getSupabaseClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  if (authHeader) return createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
  return createClient(supabaseUrl, supabaseKey);
}

/** Une partes de domicilio típicas del padrón AFIP (a veces viene calle+numero y no "direccion"). */
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
  const loc = String(d.localidad || d.localidadDescripcion || d.municipio || d.descripcionLocalidad || '').trim();
  const prov = String(d.descripcionProvincia || d.provincia || d.provinciaDescripcion || '').trim();
  const cp = String(d.codPostal || d.cp || d.codigoPostal || '').trim();
  const parts = [linea1, loc, prov, cp].filter((p) => p.length > 0);
  return parts.join(', ').trim();
}

/** Busca en el subárbol de `datosGenerales` un nodo del que se pueda armar domicilio (profundidad acotada). */
function deepFindDomicilioEnDatosGenerales(node: unknown, depth: number): string {
  if (depth <= 0 || node == null) return '';
  const direct = buildDomicilioString(node);
  if (direct) return direct;
  if (typeof node !== 'object') return '';
  for (const v of Object.values(node)) {
    if (v != null && typeof v === 'object') {
      const s = deepFindDomicilioEnDatosGenerales(v, depth - 1);
      if (s) return s;
    }
  }
  return '';
}

/** Recorre candidatos hasta obtener un texto no vacío. */
function extractDomicilioFromPersona(persona: Record<string, unknown>): string {
  const dg = persona.datosGenerales as Record<string, unknown> | undefined;
  const push = (arr: unknown[], v: unknown) => {
    if (v == null) return;
    if (Array.isArray(v)) for (const item of v) arr.push(item);
    else arr.push(v);
  };
  const candidates: unknown[] = [];
  if (dg) {
    push(candidates, dg.domicilio);
    push(candidates, dg.domicilioFiscal);
    push(candidates, dg.domicilioFiscalDeReferencia);
  }
  push(candidates, persona.domicilioFiscal);
  push(candidates, persona.domicilio);

  for (const c of candidates) {
    const s = buildDomicilioString(c);
    if (s) return s;
  }
  if (dg && typeof dg === 'object') {
    const deep = deepFindDomicilioEnDatosGenerales(dg, 8);
    if (deep) return deep;
  }
  return '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseClient(authHeader);
    const { cuit } = await req.json();
    if (!cuit) throw new Error('CUIT requerido');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión inválida');
    const { data: contribuyente } = await supabase.from('contribuyentes').select('*').eq('user_id', user.id).single();
    if (!contribuyente) throw new Error('No se encontró configuración');

    const arca = new Arca({
      key: contribuyente.arca_key, cert: contribuyente.arca_cert,
      cuit: parseInt(contribuyente.cuit, 10), production: contribuyente.arca_production === true,
      handleTicket: true, useHttpsAgent: false,
      authRepository: new SupabaseAuthRepository(supabase, user.id, contribuyente.arca_ticket),
    });

    try {
      const persona = await arca.registerScopeThirteenService.getTaxpayerDetails(parseInt(String(cuit), 10));
      if (!persona) return new Response(JSON.stringify({ success: false, error: 'CUIT no encontrado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const dg = persona.datosGenerales as Record<string, unknown> | undefined;
      const personaObj = persona as Record<string, unknown>;
      const domicilioString = extractDomicilioFromPersona(personaObj);

      return new Response(JSON.stringify({
        success: true,
        data: {
          razon_social: dg?.razonSocial || `${dg?.apellido || ''} ${dg?.nombre || ''}`.trim(),
          domicilio: domicilioString || 'No especificado en padrón',
          condicion_iva: 'Responsable Monotributo',
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (afipErr: any) {
      return new Response(JSON.stringify({ success: false, error: `AFIP: ${afipErr.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
