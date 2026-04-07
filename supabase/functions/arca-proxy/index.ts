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

function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
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

function extractWsfeResult(result: any) {
  const detail =
    result?.FECAESolicitarResult?.FeDetResp?.FECAEDetResponse?.[0] ??
    result?.FeCabResp?.FECAEDetResponse?.[0] ??
    result?.detail ??
    result;

  const header = result?.FECAESolicitarResult?.FeCabResp ?? result?.FeCabResp ?? {};
  const errors =
    result?.FECAESolicitarResult?.Errors?.Err ??
    result?.Errors?.Err ??
    result?.errors ??
    [];
  const observations =
    detail?.Observaciones?.Obs ??
    result?.FECAESolicitarResult?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ??
    result?.observaciones?.obs ??
    result?.Observaciones?.Obs ??
    [];

  return {
    raw: result,
    detail,
    header,
    resultado: detail?.Resultado ?? detail?.resultado ?? header?.Resultado ?? header?.resultado,
    cae: detail?.CAE ?? detail?.cae,
    caeFchVto: detail?.CAEFchVto ?? detail?.caeFchVto,
    cbteDesde: detail?.CbteDesde ?? detail?.cbteDesde,
    cbteTipo: detail?.CbteTipo ?? detail?.cbteTipo,
    ptoVta: detail?.PtoVta ?? detail?.ptoVta,
    errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
    observations: Array.isArray(observations) ? observations : [observations].filter(Boolean),
  };
}

function summarizeUnknownResult(raw: any): string {
  try {
    const serialized = JSON.stringify(raw);
    if (!serialized) {
      return '';
    }
    return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
  } catch {
    return String(raw ?? '');
  }
}

async function getUserArcaInstance(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('No autorizado');

  const supabaseUser = getSupabaseClient(authHeader);
  const supabaseAdmin = getServiceRoleClient();
  
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) throw new Error('Token inválido');

  const db = supabaseAdmin ?? supabaseUser;

  const { data: contribuyente } = await db
    .from('contribuyentes')
    .select('cuit, arca_cert, arca_key, arca_production, arca_ticket')
    .eq('user_id', user.id)
    .single();

  if (!contribuyente) throw new Error('No se encontró el contribuyente');
  if (!contribuyente.arca_cert || !contribuyente.arca_key) throw new Error('Certificados no configurados');

  const arca = new Arca({
    cert: contribuyente.arca_cert,
    key: contribuyente.arca_key,
    cuit: parseInt(contribuyente.cuit, 10),
    production: contribuyente.arca_production === true,
    handleTicket: true,
    useHttpsAgent: false,
    authRepository: new SupabaseAuthRepository(db, user.id, contribuyente.arca_ticket),
  });

  return { arca, userId: user.id };
}

async function handleCrearFactura(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante, monto, fecha, concepto_afip, iva_porcentaje } = body;

  try {
    // ========== VALIDACIONES PREVIAS ==========
    if (!punto_venta || !Number.isInteger(punto_venta) || punto_venta <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Validación fallida: punto_venta debe ser un número entero positivo'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!tipo_comprobante || typeof tipo_comprobante !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Validación fallida: tipo_comprobante es requerido'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const montoTotal = parseFloat(monto);
    if (!monto || isNaN(montoTotal) || montoTotal <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Validación fallida: monto debe ser un número positivo'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Validación fallida: fecha debe estar en formato YYYY-MM-DD'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== OBTENER INSTANCIA ARCA ==========
    const { arca } = await getUserArcaInstance(req);
    const cbteTipo = getCbteTipo(tipo_comprobante);

    console.log(`[handleCrearFactura] Iniciando creación de factura - PtoVta: ${punto_venta}, Tipo: ${tipo_comprobante}, Monto: ${montoTotal}`);

    // ========== OBTENER NÚMERO SECUENCIAL ==========
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
    const vNumber = typeof lastVoucher === 'number' ? lastVoucher : (lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0);
    const cbteNro = vNumber + 1;

    console.log(`[handleCrearFactura] Último comprobante: ${vNumber}, Nuevo número: ${cbteNro}`);

    // ========== CALCULAR MONTOS ==========
    const isFacturaC = String(tipo_comprobante).toUpperCase().includes(' C');
    const ivaPct = iva_porcentaje || 21;

    let impNeto, impIVA, iva;
    if (isFacturaC) {
      impNeto = montoTotal;
      impIVA = 0;
      iva = undefined;
      console.log(`[handleCrearFactura] Factura C - Sin IVA`);
    } else {
      impNeto = parseFloat((montoTotal / (1 + ivaPct / 100)).toFixed(2));
      impIVA = parseFloat((montoTotal - impNeto).toFixed(2));
      iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];
      console.log(`[handleCrearFactura] Cálculo de IVA - Neto: ${impNeto}, IVA: ${impIVA} (${ivaPct}%)`);
    }

    const conceptoNum = concepto_afip || 2;
    const fechaNum = parseInt(String(fecha).replace(/-/g, ''), 10);

    // ========== CONSTRUIR PAYLOAD ==========
    const voucherPayload: any = {
      CantReg: 1,
      PtoVta: punto_venta,
      CbteTipo: cbteTipo,
      Concepto: conceptoNum,
      DocTipo: 99,
      DocNro: 0,
      CbteDesde: cbteNro,
      CbteHasta: cbteNro,
      CbteFch: fechaNum,
      ImpTotal: montoTotal,
      ImpTotConc: 0,
      ImpNeto: impNeto,
      ImpOpEx: 0,
      ImpIVA: impIVA,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
    };

    if (iva) voucherPayload.Iva = iva;

    if (conceptoNum >= 2) {
      voucherPayload.FchServDesde = fechaNum;
      voucherPayload.FchServHasta = fechaNum;
      voucherPayload.FchVtoPago = fechaNum;
    }

    console.log(`[handleCrearFactura] Payload enviado a AFIP:`, JSON.stringify(voucherPayload, null, 2));

    // ========== ENVIAR A AFIP ==========
    const response = await arca.electronicBillingService.createVoucher(voucherPayload);
    const result: any = response;
    const parsed = extractWsfeResult(result);

    console.log(`[handleCrearFactura] Response de AFIP:`, JSON.stringify(parsed.raw, null, 2));

    // ========== VALIDAR RESPUESTA ==========
    const isSuccess = parsed.resultado === 'A';

    if (!isSuccess) {
      const detalleErrores = parsed.errors
        .map((err: any) => `[${err.Code || err.code}] ${err.Msg || err.msg}`)
        .join(' | ');
      const detalleObservaciones = parsed.observations
        .map((obs: any) => `[${obs.Code || obs.code}] ${obs.Msg || obs.msg}`)
        .join(' | ');
      const rawSummary = summarizeUnknownResult(parsed.raw);

      const detalle = [detalleErrores, detalleObservaciones].filter(Boolean).join(' | ');
      const errorMessage = detalle
        ? `Error AFIP (${parsed.resultado || 'sin resultado'}): ${detalle}`
        : rawSummary
          ? `Error AFIP: respuesta no reconocida (${parsed.resultado || 'sin resultado'}). Raw: ${rawSummary}`
          : `Error AFIP: La solicitud fue rechazada por AFIP (Resultado: ${parsed.resultado || 'sin resultado'})`;

      console.error(`[handleCrearFactura] Error en respuesta AFIP:`, {
        resultado: parsed.resultado,
        errores: detalleErrores,
        observaciones: detalleObservaciones,
        errorCompleto: errorMessage,
        rawSummary,
        raw: parsed.raw,
      });

      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
        debug: {
          afipResponse: parsed.resultado,
          errores: detalleErrores,
          observaciones: detalleObservaciones,
          rawSummary,
          raw: parsed.raw,
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========== RESPUESTA EXITOSA ==========
    const successResponse = {
      success: true,
      data: {
        CAE: parsed.cae,
        CAEFchVto: parsed.caeFchVto,
        CbteDesde: parsed.cbteDesde || cbteNro,
        CbteTipo: cbteTipo,
        PtoVta: punto_venta,
        Resultado: parsed.resultado,
      },
    };

    console.log(`[handleCrearFactura] Factura creada exitosamente - CAE: ${successResponse.data.CAE}, Número: ${successResponse.data.CbteDesde}`);

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error(`[handleCrearFactura] Error durante creación de factura:`, {
      mensaje: err.message,
      stack: err.stack,
      detalles: err,
    });

    return new Response(JSON.stringify({
      success: false,
      error: `Error del servidor: ${err.message}`,
      debug: {
        detalle: err.message,
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCrearNotaCredito(req: Request, body: any): Promise<Response> {
  try {
    const { arca } = await getUserArcaInstance(req);
    const { punto_venta, tipo_comprobante_original, monto, iva_porcentaje, cbte_asociado_nro, cbte_asociado_fecha, cuit_asociado } = body;

    const tipoNC = String(tipo_comprobante_original).toUpperCase().includes('C') ? 'NOTA DE CREDITO C' : 'NOTA DE CREDITO B';
    const cbteTipo = getCbteTipo(tipoNC);
    const cbteTipoOriginal = getCbteTipo(tipo_comprobante_original);

    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
    const vNumber = typeof lastVoucher === 'number' ? lastVoucher : (lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0);
    const cbteNro = vNumber + 1;

    const ivaPct = iva_porcentaje || 21;
    const montoTotal = parseFloat(monto);
    const impNeto = parseFloat((montoTotal / (1 + ivaPct / 100)).toFixed(2));
    const impIVA = parseFloat((montoTotal - impNeto).toFixed(2));
    const iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];

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

    const response = await arca.electronicBillingService.createVoucher(voucherPayload);
    const result: any = response;

    if (result.resultado !== 'A' && result.Resultado !== 'A') {
      const obs = result.observaciones?.obs?.map((o: any) => `${o.code}: ${o.msg}`).join('; ') || 
                  result.Observaciones?.Obs?.map((o: any) => `${o.Code}: ${o.Msg}`).join('; ') || 'Error AFIP';
      return new Response(JSON.stringify({ success: false, error: obs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function handleUltimoComprobante(req: Request, body: any): Promise<Response> {
  try {
    const { arca } = await getUserArcaInstance(req);
    const { punto_venta, tipo_comprobante } = body;
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, getCbteTipo(tipo_comprobante));
    const ultimoCbteNro = typeof lastVoucher === 'number' ? lastVoucher : (lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0);
    return new Response(JSON.stringify({ success: true, data: { ultimo_comprobante: ultimoCbteNro } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    if (req.method !== 'POST') return new Response(JSON.stringify({ success: false, error: 'POST required' }), { status: 405, headers: corsHeaders });

    const body = await req.json();
    switch (action) {
      case 'crear-factura': return await handleCrearFactura(req, body);
      case 'crear-nota-credito': return await handleCrearNotaCredito(req, body);
      case 'ultimo-comprobante': return await handleUltimoComprobante(req, body);
      default: return new Response(JSON.stringify({ success: false, error: 'Acción inválida' }), { status: 400, headers: corsHeaders });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
