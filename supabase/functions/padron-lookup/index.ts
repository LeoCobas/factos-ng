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
    const { error } = await this.supabaseClient
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
    if (!authHeader) throw new Error('Falta header de autorización');

    const supabase = getSupabaseClient(authHeader);

    const body = await req.json();
    const { cuit } = body;
    
    if (!cuit) throw new Error('Falta CUIT en body');

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Sesión inválida');

    const { data: contribuyente, error: dbError } = await supabase
      .from('contribuyentes')
      .select('cuit, arca_cert, arca_key, arca_production, arca_ticket')
      .eq('user_id', user.id)
      .single();

    if (dbError || !contribuyente) throw new Error('No se encontró la configuración del usuario');

    const isProduction = contribuyente.arca_production === true;
    
    const arcaOptions = {
      key: contribuyente.arca_key,
      cert: contribuyente.arca_cert,
      cuit: parseInt(contribuyente.cuit, 10),
      production: isProduction,
      handleTicket: true,
      useHttpsAgent: false,
      authRepository: new SupabaseAuthRepository(supabase, user.id, contribuyente.arca_ticket),
    };
    
    const arca = new Arca(arcaOptions);

    const cuitNum = parseInt(String(cuit), 10);
    
    let persona;
    try {
      persona = await arca.registerScopeThirteen.getTaxpayerDetails(cuitNum);
    } catch (afipErr: any) {
      console.error("AFIP ERROR:", afipErr);
      return new Response(JSON.stringify({ error: `[AFIP]: ${afipErr.message}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!persona) {
      return new Response(JSON.stringify({ error: 'No se encontró el CUIT en el padrón' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const datosPersona = persona.datosGenerales || persona;
    const result = {
      razon_social: datosPersona.razonSocial || `${datosPersona.apellido || ''} ${datosPersona.nombre || ''}`.trim(),
      domicilio: 'Domicilio disponible en padrón', 
      condicion_iva: 'Responsable Monotributo',
      tipo_persona: datosPersona.tipoPersona || 'FISICA',
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('SERVER ERROR:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error técnico de sistema' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
