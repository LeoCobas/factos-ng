import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Arca, AuthRepository } from '@arcasdk/core';

async function run() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: userConfigs } = await supabase.from('contribuyentes').select('*');
  const user = userConfigs[0];

  console.log("Certificate starts with:", user.arca_cert.substring(0, 50));
  console.log("Key starts with:", user.arca_key.substring(0, 50));

  class MockAuth implements AuthRepository {
    async get(cuit: number) { return user.arca_ticket; }
    async save(cuit: number, creds: any) { 
      console.log('SAVING CREDS!', Object.keys(creds));
      await supabase.from('contribuyentes').update({ arca_ticket: creds }).eq('id', user.id);
    }
  }

  const arca = new Arca({
    cuit: Number(user.cuit),
    cert: user.arca_cert,
    key: user.arca_key,
    production: false,
    handleTicket: true,
    authRepository: new MockAuth()
  });

  try {
    const res = await arca.registerScopeThirteen.getTaxpayerDetails(Number(user.cuit));
    console.log("Success:", res?.datosGenerales?.razonSocial);
  } catch(e: any) {
    console.log("ERROR:", e.message);
  }
}

run();
