import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Arca, AuthRepository, ServiceNamesEnum, AccessTicket } from "https://esm.sh/@arcasdk/core@0.3.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Use Anon Key but pass the user's header so we get their RLS session
function getSupabaseClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  if (authHeader) {
    return createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
  }
  
  // Admin client for tasks that bypass RLS (like the shared ticket cache)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}

async function getOrRefreshTicket(cert: string, key: string, cuit: number, production: boolean): Promise<any | null> {
  const supabaseAdmin = getSupabaseClient(null); // use service role
  const serviceName = 'wsfe';

  const { data: existing } = await supabaseAdmin
    .from('wsaa_tickets')
    .select('*')
    .eq('cuit', String(cuit))
    .eq('service_name', serviceName)
    .single();

  if (existing && new Date(existing.expires_at) > new Date()) {
    return existing.credentials;
  }

  try {
    const authRepository = new AuthRepository({
      cert,
      key,
      cuit,
      production,
      handleTicket: false,
    });

    const ticket: AccessTicket = await authRepository.login(ServiceNamesEnum.WSFE);
    const credentials = ticket.toLoginCredentials();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 11);

    await supabaseAdmin
      .from('wsaa_tickets')
      .upsert({
        cuit: String(cuit),
        service_name: serviceName,
        credentials,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'cuit,service_name' });

    return credentials;
  } catch (error) {
    console.error('WSAA auth failed:', error);
    throw new Error(`Error de autenticación WSAA: ${error instanceof Error ? error.message : 'desconocido'}`);
  }
}

function getCbteTipo(tipoComprobante: string): number {
  const tipos: Record<string, number> = {
    'FACTURA A': 1, 'NOTA DE DEBITO A': 2, 'NOTA DE CREDITO A': 3,
    'FACTURA B': 6, 'NOTA DE DEBITO B': 7, 'NOTA DE CREDITO B': 8,
    'FACTURA C': 11, 'NOTA DE DEBITO C': 12, 'NOTA DE CREDITO C': 13,
  };
  const code = tipos[tipoComprobante.toUpperCase()];
  if (!code) throw new Error(`Tipo de comprobante no soportado: ${tipoComprobante}`);
  return code;
}

function getIvaId(porcentaje: number): number {
  const mapping: Record<number, number> = {
    0: 3, 10.5: 4, 21: 5, 27: 6, 5: 8, 2.5: 9,
  };
  return mapping[porcentaje] || 5; 
}

async function getUserArcaInstance(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('No autorizado');

  const supabaseUser = getSupabaseClient(authHeader);
  
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) throw new Error('Token inválido');

  const { data: contribuyente, error: dbError } = await supabaseUser
    .from('contribuyentes')
    .select('cuit, arca_cert, arca_key, arca_production')
    .eq('user_id', user.id)
    .single();

  if (dbError || !contribuyente) throw new Error('No se encontró el contribuyente');
  if (!contribuyente.arca_cert || !contribuyente.arca_key) throw new Error('Certificados no configurados');

  const cert = contribuyente.arca_cert;
  const key = contribuyente.arca_key;
  const cuit = parseInt(contribuyente.cuit);
  const production = contribuyente.arca_production === true;

  const credentials = await getOrRefreshTicket(cert, key, cuit, production);

  const arca = new Arca({
    cert, key, cuit, production, handleTicket: true,
    credentials: credentials || undefined,
  });

  return { arca, cuit, isProduction: production };
}

async function handleCrearFactura(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante, monto, fecha, concepto_afip, iva_porcentaje } = body;

  if (!punto_venta || !tipo_comprobante || !monto || !fecha) {
    return new Response(JSON.stringify({ success: false, error: 'Faltan campos requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { arca } = await getUserArcaInstance(req);
  const cbteTipo = getCbteTipo(tipo_comprobante);

  const lastVoucher = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
  const cbteNro = (lastVoucher || 0) + 1;

  const isFacturaC = tipo_comprobante.toUpperCase().includes(' C');
  const ivaPct = iva_porcentaje || 21;
  const montoTotal = parseFloat(monto);

  let impNeto, impIVA, iva;
  if (isFacturaC) {
    impNeto = montoTotal; impIVA = 0; iva = undefined;
  } else {
    impNeto = parseFloat((montoTotal / (1 + ivaPct / 100)).toFixed(2));
    impIVA = parseFloat((montoTotal - impNeto).toFixed(2));
    iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];
  }

  const conceptoNum = concepto_afip || 2; 
  const fechaNum = parseInt(fecha.replace(/-/g, ''));

  const voucherPayload: any = {
    CantReg: 1, PtoVta: punto_venta, CbteTipo: cbteTipo,
    Concepto: conceptoNum, DocTipo: 99, DocNro: 0,
    CbteDesde: cbteNro, CbteHasta: cbteNro, CbteFch: fechaNum,
    ImpTotal: montoTotal, ImpTotConc: 0, ImpNeto: impNeto,
    ImpOpEx: 0, ImpIVA: impIVA, ImpTrib: 0, MonId: 'PES', MonCotiz: 1,
  };

  if (iva) voucherPayload.Iva = iva;

  if (conceptoNum >= 2) {
    voucherPayload.FchServDesde = fechaNum;
    voucherPayload.FchServHasta = fechaNum;
    voucherPayload.FchVtoPago = fechaNum;
  }

  const result = await arca.electronicBillingService.createVoucher(voucherPayload);

  if (result.Resultado !== 'A') {
    const obs = result.Observaciones?.Obs?.map((o: any) => `${o.Code}: ${o.Msg}`).join('; ') || 'Error ARCA';
    return new Response(JSON.stringify({ success: false, error: obs }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    success: true,
    data: { CAE: result.CAE, CAEFchVto: result.CAEFchVto, CbteDesde: result.CbteDesde || cbteNro, CbteTipo: cbteTipo, PtoVta: punto_venta, Resultado: result.Resultado }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCrearNotaCredito(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante_original, monto, iva_porcentaje, cbte_asociado_nro, cbte_asociado_fecha, cuit_asociado } = body;
  
  if (!punto_venta || !tipo_comprobante_original || !monto) {
    return new Response(JSON.stringify({ success: false, error: 'Faltan campos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { arca } = await getUserArcaInstance(req);

  const tipoNC = tipo_comprobante_original.toUpperCase().includes('C') ? 'NOTA DE CREDITO C' : 'NOTA DE CREDITO B';
  const cbteTipo = getCbteTipo(tipoNC);
  const cbteTipoOriginal = getCbteTipo(tipo_comprobante_original);

  const lastVoucher = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
  const cbteNro = (lastVoucher || 0) + 1;

  const isNC_C = tipoNC === 'NOTA DE CREDITO C';
  const ivaPct = iva_porcentaje || 21;
  const montoTotal = parseFloat(monto);

  let impNeto, impIVA, iva;
  if (isNC_C) {
    impNeto = montoTotal; impIVA = 0; iva = undefined;
  } else {
    impNeto = parseFloat((montoTotal / (1 + ivaPct / 100)).toFixed(2));
    impIVA = parseFloat((montoTotal - impNeto).toFixed(2));
    iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];
  }

  const fechaHoy = parseInt(new Date().toISOString().split('T')[0].replace(/-/g, ''));

  const voucherPayload: any = {
    CantReg: 1, PtoVta: punto_venta, CbteTipo: cbteTipo,
    Concepto: 2, DocTipo: 99, DocNro: 0,
    CbteDesde: cbteNro, CbteHasta: cbteNro, CbteFch: fechaHoy,
    ImpTotal: montoTotal, ImpTotConc: 0, ImpNeto: impNeto,
    ImpOpEx: 0, ImpIVA: impIVA, ImpTrib: 0, MonId: 'PES', MonCotiz: 1,
    FchServDesde: fechaHoy, FchServHasta: fechaHoy, FchVtoPago: fechaHoy,
    CbtesAsoc: [{
      Tipo: cbteTipoOriginal, PtoVta: punto_venta, Nro: cbte_asociado_nro || 1,
      Cuit: cuit_asociado ? parseInt(cuit_asociado) : undefined, CbteFch: cbte_asociado_fecha || fechaHoy,
    }],
  };
  if (iva) voucherPayload.Iva = iva;

  const result = await arca.electronicBillingService.createVoucher(voucherPayload);

  if (result.Resultado !== 'A') {
    const obs = result.Observaciones?.Obs?.map((o: any) => `${o.Code}: ${o.Msg}`).join('; ') || 'Error desconocido';
    return new Response(JSON.stringify({ success: false, error: obs }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    success: true,
    data: { CAE: result.CAE, CAEFchVto: result.CAEFchVto, CbteDesde: result.CbteDesde || cbteNro, CbteTipo: cbteTipo, PtoVta: punto_venta, Resultado: result.Resultado }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleUltimoComprobante(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante } = body;
  
  if (!punto_venta || !tipo_comprobante) {
    return new Response(JSON.stringify({ success: false, error: 'Faltan campos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { arca } = await getUserArcaInstance(req);
  const lastVoucher = await arca.electronicBillingService.getLastVoucher(punto_venta, getCbteTipo(tipo_comprobante));

  return new Response(JSON.stringify({ success: true, data: { ultimo_comprobante: lastVoucher || 0 } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Solo se acepta POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();

    switch (action) {
      case 'crear-factura': return await handleCrearFactura(req, body);
      case 'crear-nota-credito': return await handleCrearNotaCredito(req, body);
      case 'ultimo-comprobante': return await handleUltimoComprobante(req, body);
      default: return new Response(JSON.stringify({ success: false, error: 'Acción inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Error interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
