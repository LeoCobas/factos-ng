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

  async get(cuit: number): Promise<any | null> {
    return this.dbTicket;
  }

  async save(cuit: number, credentials: any): Promise<void> {
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
      global: { headers: { Authorization: authHeader } }
    });
  }
  return createClient(supabaseUrl, supabaseKey);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseClient(authHeader);

    const body = await req.json();
    const { cuit } = body;
    
    if (!cuit) throw new Error('CUIT requerido');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión inválida');

    const { data: contribuyente } = await supabase
      .from('contribuyentes')
      .select('cuit, arca_cert, arca_key, arca_production, arca_ticket')
      .eq('user_id', user.id)
      .single();

    if (!contribuyente) throw new Error('No se encontró configuración');

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
        return new Response(JSON.stringify({ success: false, error: 'CUIT no encontrado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const datosPersona = persona.datosGenerales || persona;
      
      const dom = Array.isArray(persona.domicilio) 
        ? (persona.domicilio.find((d: any) => d.tipoDomicilio === 'FISCAL') || persona.domicilio[0])
        : persona.domicilio;
      
      let domicilioString = '';
      if (dom) {
        domicilioString = `${dom.direccion || ''} ${dom.localidad || ''} ${dom.descripcionProvincia || ''}`.trim();
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          razon_social: datosPersona.razonSocial || `${datosPersona.apellido || ''} ${datosPersona.nombre || ''}`.trim(),
          domicilio: domicilioString || 'No especificado en padrón',
          condicion_iva: 'Responsable Monotributo',
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (afipErr: any) {
      console.error("AFIP ERROR:", afipErr);
      return new Response(JSON.stringify({ success: false, error: `Error AFIP: ${afipErr.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
