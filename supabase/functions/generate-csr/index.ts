import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import forge from 'npm:node-forge@1.3.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) throw new Error('No autorizado');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error('Sesión inválida');

    const { cuit, razon_social } = await req.json();
    if (!cuit || !razon_social) throw new Error('CUIT y Razón Social requeridos');

    const cleanCuit = String(cuit).replace(/\D/g, '');
    if (cleanCuit.length !== 11) {
      throw new Error('El CUIT debe tener exactamente 11 dígitos');
    }

    // Generate RSA Keypair 2048-bit
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Create CSR
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    
    // Set Subject for ARCA
    csr.setSubject([
      { name: 'commonName', value: `Factos-NG-${cleanCuit}` },
      { name: 'countryName', value: 'AR' },
      { name: 'organizationName', value: razon_social },
      { name: 'serialNumber', value: `CUIT ${cleanCuit}` }
    ]);

    // Sign CSR
    csr.sign(keys.privateKey, forge.md.sha256.create());

    const pemPrivateKey = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCsr = forge.pki.certificationRequestToPem(csr);

    return new Response(
      JSON.stringify({
        success: true,
        csr: pemCsr,
        private_key: pemPrivateKey,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
