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
  contribuyenteId: string;
  dbTicket: any;

  constructor(supabaseClient: any, contribuyenteId: string, dbTicket: any) {
    this.supabaseClient = supabaseClient;
    this.contribuyenteId = contribuyenteId;
    this.dbTicket = dbTicket || null;
  }

  async get(_cuit: number): Promise<any | null> {
    return this.dbTicket;
  }

  async save(_cuit: number, credentials: any): Promise<void> {
    await this.supabaseClient
      .from('contribuyentes')
      .update({ arca_ticket: credentials })
      .eq('id', this.contribuyenteId);
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

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No autorizado');

  const supabase = getSupabaseClient(authHeader);
  const token = authHeader.replace('Bearer ', '').trim();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error('Sesion invalida');
  return { supabase, user };
}

function getCbteTipo(tipoComprobante: string): number {
  const tipos: Record<string, number> = {
    'FACTURA A': 1,
    'NOTA DE DEBITO A': 2,
    'NOTA DE CREDITO A': 3,
    'FACTURA B': 6,
    'NOTA DE DEBITO B': 7,
    'NOTA DE CREDITO B': 8,
    'FACTURA C': 11,
    'NOTA DE DEBITO C': 12,
    'NOTA DE CREDITO C': 13,
  };
  const code = tipos[tipoComprobante.toUpperCase()];
  if (!code) throw new Error(`Tipo de comprobante no soportado: ${tipoComprobante}`);
  return code;
}

function getIvaId(porcentaje: number): number {
  const mapping: Record<number, number> = {
    0: 3,
    10.5: 4,
    21: 5,
    27: 6,
    5: 8,
    2.5: 9,
  };
  return mapping[porcentaje] || 5;
}

function getCondicionIvaReceptorId(condicionIvaReceptorId?: number, docTipo?: number): number {
  if (Number.isInteger(condicionIvaReceptorId) && Number(condicionIvaReceptorId) > 0) {
    return Number(condicionIvaReceptorId);
  }

  if (docTipo === 99) {
    return 5;
  }

  return 5;
}

function getDocPayload(body: any) {
  return {
    docTipo: Number.isInteger(body?.doc_tipo) ? Number(body.doc_tipo) : 99,
    docNro: Number.isFinite(Number(body?.doc_nro)) ? Number(body.doc_nro) : 0,
    condicionIvaReceptorId: getCondicionIvaReceptorId(
      Number(body?.condicion_iva_receptor_id),
      Number.isInteger(body?.doc_tipo) ? Number(body.doc_tipo) : 99
    ),
  };
}

function getTodayInArgentina(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function extractWsfeResult(result: any) {
  const payload = result?.response ?? result;
  const detail =
    payload?.FECAESolicitarResult?.FeDetResp?.FECAEDetResponse?.[0] ??
    payload?.FeDetResp?.FECAEDetResponse?.[0] ??
    payload?.detail ??
    payload;

  const header = payload?.FECAESolicitarResult?.FeCabResp ?? payload?.FeCabResp ?? {};
  const errors = payload?.FECAESolicitarResult?.Errors?.Err ?? payload?.Errors?.Err ?? payload?.errors ?? [];
  const observations =
    detail?.Observaciones?.Obs ??
    payload?.FECAESolicitarResult?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ??
    payload?.observaciones?.obs ??
    payload?.Observaciones?.Obs ??
    [];
  const events = payload?.FECAESolicitarResult?.Events?.Evt ?? payload?.Events?.Evt ?? [];

  return {
    raw: payload,
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
    events: Array.isArray(events) ? events : [events].filter(Boolean),
  };
}

function summarizeUnknownResult(raw: any): string {
  try {
    const serialized = JSON.stringify(raw);
    if (!serialized) return '';
    return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
  } catch {
    return String(raw ?? '');
  }
}

async function getUserArcaInstance(req: Request) {
  const { supabase: supabaseUser, user } = await getAuthenticatedUser(req);

  const { data: contribuyente, error } = await supabaseUser
    .from('contribuyentes')
    .select('id, cuit, arca_cert, arca_key, arca_production, arca_ticket')
    .eq('user_id', user.id)
    .single();

  if (error) throw new Error(error.message || 'No se pudo obtener el contribuyente');
  if (!contribuyente) throw new Error('No se encontro el contribuyente');
  if (!contribuyente.arca_cert || !contribuyente.arca_key) {
    throw new Error('Certificados no configurados');
  }

  const arca = new Arca({
    cert: contribuyente.arca_cert,
    key: contribuyente.arca_key,
    cuit: parseInt(contribuyente.cuit, 10),
    production: contribuyente.arca_production === true,
    handleTicket: true,
    useHttpsAgent: false,
    authRepository: new SupabaseAuthRepository(
      supabaseUser,
      contribuyente.id,
      contribuyente.arca_ticket
    ),
  });

  return { arca };
}

function buildErrorResponse(errorMessage: string, extra?: Record<string, unknown>, status = 400) {
  return new Response(JSON.stringify({ success: false, error: errorMessage, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCrearFactura(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante, monto, fecha, concepto_afip, iva_porcentaje } = body;
  const { docTipo, docNro, condicionIvaReceptorId } = getDocPayload(body);

  try {
    if (!punto_venta || !Number.isInteger(punto_venta) || punto_venta <= 0) {
      return buildErrorResponse('Validacion fallida: punto_venta debe ser un numero entero positivo');
    }

    if (!tipo_comprobante || typeof tipo_comprobante !== 'string') {
      return buildErrorResponse('Validacion fallida: tipo_comprobante es requerido');
    }

    const montoTotal = parseFloat(monto);
    if (!monto || isNaN(montoTotal) || montoTotal <= 0) {
      return buildErrorResponse('Validacion fallida: monto debe ser un numero positivo');
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
      return buildErrorResponse('Validacion fallida: fecha debe estar en formato YYYY-MM-DD');
    }

    const { arca } = await getUserArcaInstance(req);
    const cbteTipo = getCbteTipo(tipo_comprobante);
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
    const lastNumber =
      typeof lastVoucher === 'number' ? lastVoucher : lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0;
    const cbteNro = lastNumber + 1;

    const isFacturaC = String(tipo_comprobante).toUpperCase().includes(' C');
    const ivaPct = iva_porcentaje || 21;
    let impNeto: number;
    let impIVA: number;
    let iva: any[] | undefined;

    if (isFacturaC) {
      impNeto = montoTotal;
      impIVA = 0;
      iva = undefined;
    } else {
      impNeto = parseFloat((montoTotal / (1 + ivaPct / 100)).toFixed(2));
      impIVA = parseFloat((montoTotal - impNeto).toFixed(2));
      iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];
    }

    const conceptoNum = concepto_afip || 2;
    const fechaNum = parseInt(String(fecha).replace(/-/g, ''), 10);
    const voucherPayload: any = {
      CantReg: 1,
      PtoVta: punto_venta,
      CbteTipo: cbteTipo,
      Concepto: conceptoNum,
      DocTipo: docTipo,
      DocNro: docNro,
      CondicionIVAReceptorId: condicionIvaReceptorId,
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

    if (iva) {
      voucherPayload.Iva = iva;
    }

    if (conceptoNum >= 2) {
      voucherPayload.FchServDesde = fechaNum;
      voucherPayload.FchServHasta = fechaNum;
      voucherPayload.FchVtoPago = fechaNum;
    }

    const parsed = extractWsfeResult(await arca.electronicBillingService.createVoucher(voucherPayload));

    if (parsed.resultado !== 'A') {
      const detalleErrores = parsed.errors
        .map((err: any) => `[${err.Code || err.code}] ${err.Msg || err.msg}`)
        .join(' | ');
      const detalleObservaciones = parsed.observations
        .map((obs: any) => `[${obs.Code || obs.code}] ${obs.Msg || obs.msg}`)
        .join(' | ');
      const detalleEventos = parsed.events
        .map((evt: any) => `[${evt.Code || evt.code}] ${evt.Msg || evt.msg}`)
        .join(' | ');
      const rawSummary = summarizeUnknownResult(parsed.raw);
      const detalle = [detalleErrores, detalleObservaciones, detalleEventos].filter(Boolean).join(' | ');
      const errorMessage = detalle
        ? `Error AFIP (${parsed.resultado || 'sin resultado'}): ${detalle}`
        : rawSummary
          ? `Error AFIP: respuesta no reconocida (${parsed.resultado || 'sin resultado'}). Raw: ${rawSummary}`
          : `Error AFIP: La solicitud fue rechazada por AFIP (Resultado: ${parsed.resultado || 'sin resultado'})`;

      return buildErrorResponse(errorMessage, {
        debug: {
          afipResponse: parsed.resultado,
          errores: detalleErrores,
          observaciones: detalleObservaciones,
          eventos: detalleEventos,
          rawSummary,
          raw: parsed.raw,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          CAE: parsed.cae,
          CAEFchVto: parsed.caeFchVto,
          CbteDesde: parsed.cbteDesde || cbteNro,
          CbteTipo: cbteTipo,
          PtoVta: punto_venta,
          Resultado: parsed.resultado,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return buildErrorResponse(`Error del servidor: ${err.message}`, { debug: { detalle: err.message } }, 500);
  }
}

async function handleCrearNotaCredito(req: Request, body: any): Promise<Response> {
  try {
    const { arca } = await getUserArcaInstance(req);
    const {
      punto_venta,
      punto_venta_original,
      tipo_comprobante_original,
      monto,
      concepto_afip,
      iva_porcentaje,
      cbte_asociado_nro,
      cbte_asociado_fecha,
      fecha,
    } = body;
    const { docTipo, docNro, condicionIvaReceptorId } = getDocPayload(body);

    if (!punto_venta || !Number.isInteger(punto_venta) || punto_venta <= 0) {
      return buildErrorResponse('Validacion fallida: punto_venta debe ser un numero entero positivo');
    }

    if (!tipo_comprobante_original || typeof tipo_comprobante_original !== 'string') {
      return buildErrorResponse('Validacion fallida: tipo_comprobante_original es requerido');
    }

    const montoTotal = parseFloat(monto);
    if (!monto || isNaN(montoTotal) || montoTotal <= 0) {
      return buildErrorResponse('Validacion fallida: monto debe ser un numero positivo');
    }

    if (!cbte_asociado_nro || !Number.isInteger(cbte_asociado_nro) || cbte_asociado_nro <= 0) {
      return buildErrorResponse(
        'Validacion fallida: cbte_asociado_nro debe ser un numero entero positivo'
      );
    }

    if (!cbte_asociado_fecha || !/^\d{8}$/.test(String(cbte_asociado_fecha))) {
      return buildErrorResponse(
        'Validacion fallida: cbte_asociado_fecha debe estar en formato YYYYMMDD'
      );
    }

    const puntoVentaOriginal =
      Number.isInteger(punto_venta_original) && punto_venta_original > 0
        ? punto_venta_original
        : punto_venta;
    const tipoOriginal = String(tipo_comprobante_original).toUpperCase();
    const tipoNC = tipoOriginal.includes(' A')
      ? 'NOTA DE CREDITO A'
      : tipoOriginal.includes(' B')
        ? 'NOTA DE CREDITO B'
        : 'NOTA DE CREDITO C';

    const cbteTipo = getCbteTipo(tipoNC);
    const cbteTipoOriginal = getCbteTipo(tipo_comprobante_original);
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(punto_venta, cbteTipo);
    const lastNumber =
      typeof lastVoucher === 'number' ? lastVoucher : lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0;
    const cbteNro = lastNumber + 1;

    const isNcC = tipoNC === 'NOTA DE CREDITO C';
    const ivaPct = iva_porcentaje || 21;
    let impNeto: number;
    let impIVA: number;
    let iva: any[] | undefined;

    if (isNcC) {
      impNeto = montoTotal;
      impIVA = 0;
      iva = undefined;
    } else {
      impNeto = parseFloat((montoTotal / (1 + ivaPct / 100)).toFixed(2));
      impIVA = parseFloat((montoTotal - impNeto).toFixed(2));
      iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];
    }

    const conceptoNum = concepto_afip || 2;
    const fechaHoy = parseInt(String(fecha || getTodayInArgentina()).replace(/-/g, ''), 10);
    const voucherPayload: any = {
      CantReg: 1,
      PtoVta: punto_venta,
      CbteTipo: cbteTipo,
      Concepto: conceptoNum,
      DocTipo: docTipo,
      DocNro: docNro,
      CondicionIVAReceptorId: condicionIvaReceptorId,
      CbteDesde: cbteNro,
      CbteHasta: cbteNro,
      CbteFch: fechaHoy,
      ImpTotal: montoTotal,
      ImpTotConc: 0,
      ImpNeto: impNeto,
      ImpOpEx: 0,
      ImpIVA: impIVA,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      CbtesAsoc: [
        {
          Tipo: cbteTipoOriginal,
          PtoVta: puntoVentaOriginal,
          Nro: cbte_asociado_nro,
          CbteFch: parseInt(String(cbte_asociado_fecha), 10),
        },
      ],
    };

    if (iva) {
      voucherPayload.Iva = iva;
    }

    if (conceptoNum >= 2) {
      voucherPayload.FchServDesde = fechaHoy;
      voucherPayload.FchServHasta = fechaHoy;
      voucherPayload.FchVtoPago = fechaHoy;
    }

    const parsed = extractWsfeResult(await arca.electronicBillingService.createVoucher(voucherPayload));

    if (parsed.resultado !== 'A') {
      const detalleErrores = parsed.errors
        .map((err: any) => `[${err.Code || err.code}] ${err.Msg || err.msg}`)
        .join(' | ');
      const detalleObservaciones = parsed.observations
        .map((obs: any) => `[${obs.Code || obs.code}] ${obs.Msg || obs.msg}`)
        .join(' | ');
      const detalleEventos = parsed.events
        .map((evt: any) => `[${evt.Code || evt.code}] ${evt.Msg || evt.msg}`)
        .join(' | ');
      const rawSummary = summarizeUnknownResult(parsed.raw);
      const detalle = [detalleErrores, detalleObservaciones, detalleEventos].filter(Boolean).join(' | ');
      const errorMessage = detalle
        ? `Error AFIP (${parsed.resultado || 'sin resultado'}): ${detalle}`
        : rawSummary
          ? `Error AFIP: respuesta no reconocida (${parsed.resultado || 'sin resultado'}). Raw: ${rawSummary}`
          : `Error AFIP: La solicitud fue rechazada por AFIP (Resultado: ${parsed.resultado || 'sin resultado'})`;

      return buildErrorResponse(errorMessage, {
        debug: {
          afipResponse: parsed.resultado,
          errores: detalleErrores,
          observaciones: detalleObservaciones,
          eventos: detalleEventos,
          rawSummary,
          raw: parsed.raw,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          CAE: parsed.cae,
          CAEFchVto: parsed.caeFchVto,
          CbteDesde: parsed.cbteDesde || cbteNro,
          CbteTipo: cbteTipo,
          PtoVta: punto_venta,
          Resultado: parsed.resultado,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return buildErrorResponse(`Error del servidor: ${err.message}`, { debug: { detalle: err.message } }, 500);
  }
}

async function handleUltimoComprobante(req: Request, body: any): Promise<Response> {
  try {
    const { arca } = await getUserArcaInstance(req);
    const { punto_venta, tipo_comprobante } = body;
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(
      punto_venta,
      getCbteTipo(tipo_comprobante)
    );
    const ultimoCbteNro =
      typeof lastVoucher === 'number' ? lastVoucher : lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0;

    return new Response(
      JSON.stringify({ success: true, data: { ultimo_comprobante: ultimoCbteNro } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    const body = await req.json();

    switch (action) {
      case 'crear-factura':
        return await handleCrearFactura(req, body);
      case 'crear-nota-credito':
        return await handleCrearNotaCredito(req, body);
      case 'ultimo-comprobante':
        return await handleUltimoComprobante(req, body);
      default:
        return new Response(JSON.stringify({ success: false, error: 'Accion invalida' }), {
          status: 400,
          headers: corsHeaders,
        });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
