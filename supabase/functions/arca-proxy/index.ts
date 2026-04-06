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
    .select('cuit, arca_cert, arca_key, arca_production, arca_ticket')
    .eq('user_id', user.id)
    .single();

  if (dbError || !contribuyente) throw new Error('No se encontró el contribuyente');
  if (!contribuyente.arca_cert || !contribuyente.arca_key) throw new Error('Certificados no configurados');

  const cert = contribuyente.arca_cert;
  const key = contribuyente.arca_key;
  const cuit = parseInt(contribuyente.cuit, 10);
  const production = contribuyente.arca_production === true;

  const arca = new Arca({
    cert, key, cuit, production, 
    handleTicket: true,
    useHttpsAgent: false,
    authRepository: new SupabaseAuthRepository(supabaseUser, user.id, contribuyente.arca_ticket),
  });

  return { arca, cuit, isProduction: production };
}

async function handleCrearFactura(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante, monto, fecha, concepto_afip, iva_porcentaje } = body;

  const { arca } = await getUserArcaInstance(req);
  const cbteTipo = getCbteTipo(tipo_comprobante);

  const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
  const vNumber = typeof lastVoucher === 'number' ? lastVoucher : (lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0);
  const cbteNro = vNumber + 1;

  const isFacturaC = String(tipo_comprobante).toUpperCase().includes(' C');
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
  const fechaNum = parseInt(String(fecha).replace(/-/g, ''), 10);

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

  const response = await arca.electronicBillingService.createVoucher(voucherPayload);
  const result: any = response;

  if (result.resultado !== 'A' && result.Resultado !== 'A') {
    const obs = result.observaciones?.obs?.map((o: any) => `${o.code}: ${o.msg}`).join('; ') || 
                result.Observaciones?.Obs?.map((o: any) => `${o.Code}: ${o.Msg}`).join('; ') || 'Error ARCA';
    return new Response(JSON.stringify({ success: false, error: obs }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    success: true,
    data: { 
      CAE: result.cae || result.CAE, 
      CAEFchVto: result.caeFchVto || result.CAEFchVto, 
      CbteDesde: result.cbteDesde || result.CbteDesde || cbteNro, 
      CbteTipo: cbteTipo, 
      PtoVta: punto_venta, 
      Resultado: result.resultado || result.Resultado 
    }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCrearNotaCredito(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante_original, monto, iva_porcentaje, cbte_asociado_nro, cbte_asociado_fecha, cuit_asociado } = body;
  const { arca } = await getUserArcaInstance(req);

  const tipoNC = String(tipo_comprobante_original).toUpperCase().includes('C') ? 'NOTA DE CREDITO C' : 'NOTA DE CREDITO B';
  const cbteTipo = getCbteTipo(tipoNC);
  const cbteTipoOriginal = getCbteTipo(tipo_comprobante_original);

  const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
  const vNumber = typeof lastVoucher === 'number' ? lastVoucher : (lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0);
  const cbteNro = vNumber + 1;

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

  const fechaHoy = parseInt(new Date().toISOString().split('T')[0].replace(/-/g, ''), 10);

  const voucherPayload: any = {
    CantReg: 1, PtoVta: punto_venta, CbteTipo: cbteTipo,
    Concepto: 2, DocTipo: 99, DocNro: 0,
    CbteDesde: cbteNro, CbteHasta: cbteNro, CbteFch: fechaHoy,
    ImpTotal: montoTotal, ImpTotConc: 0, ImpNeto: impNeto,
    ImpOpEx: 0, ImpIVA: impIVA, ImpTrib: 0, MonId: 'PES', MonCotiz: 1,
    FchServDesde: fechaHoy, FchServHasta: fechaHoy, FchVtoPago: fechaHoy,
    CbtesAsoc: [{
      Tipo: cbteTipoOriginal, PtoVta: punto_venta, Nro: cbte_asociado_nro || 1,
      Cuit: cuit_asociado ? parseInt(cuit_asociado, 10) : undefined, CbteFch: cbte_asociado_fecha || fechaHoy,
    }],
  };
  if (iva) voucherPayload.Iva = iva;

  const responseNC = await arca.electronicBillingService.createVoucher(voucherPayload);
  const result: any = responseNC;

  if (result.resultado !== 'A' && result.Resultado !== 'A') {
    const obs = result.observaciones?.obs?.map((o: any) => `${o.code}: ${o.msg}`).join('; ') || 
                result.Observaciones?.Obs?.map((o: any) => `${o.Code}: ${o.Msg}`).join('; ') || 'Error desconocido';
    return new Response(JSON.stringify({ success: false, error: obs }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    success: true,
    data: { 
      CAE: result.cae || result.CAE, 
      CAEFchVto: result.caeFchVto || result.CAEFchVto, 
      CbteDesde: result.cbteDesde || result.CbteDesde || cbteNro, 
      CbteTipo: cbteTipo, 
      PtoVta: punto_venta, 
      Resultado: result.resultado || result.Resultado 
    }
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleUltimoComprobante(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante } = body;
  const { arca } = await getUserArcaInstance(req);
  const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, getCbteTipo(tipo_comprobante));
  const ultimoCbteNro = typeof lastVoucher === 'number' ? lastVoucher : (lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0);

  return new Response(JSON.stringify({ success: true, data: { ultimo_comprobante: ultimoCbteNro } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Error interno' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
