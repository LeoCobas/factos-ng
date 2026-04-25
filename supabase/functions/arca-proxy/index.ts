import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Arca } from 'npm:@arcasdk/core@0.3.6';
import {
  readArcaTicketBucket,
  writeArcaTicketBucket,
} from '../../../src/app/core/utils/arca-ticket.util.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARCA_TICKET_PATH = '/tmp/factos-arca-tickets';
const WSFE_SERVICE_NAME = 'wsfe';
const LAST_VOUCHER_CACHE_TTL_MS = 15 * 60 * 1000;

type ArcaProxyErrorType =
  | 'arca_maintenance'
  | 'arca_auth'
  | 'network'
  | 'arca_rejected'
  | 'validation'
  | 'server';

function getTicketFilePath(cuit: number, serviceName: string, production: boolean): string {
  return `${ARCA_TICKET_PATH}/TA-${cuit}-${serviceName}${production ? '-production' : ''}.json`;
}

function isStoredTicketValid(ticket: any): boolean {
  const expirationTime = ticket?.header?.[1]?.expirationtime;
  if (!expirationTime) return false;

  const expirationMs = new Date(String(expirationTime)).getTime();
  return Number.isFinite(expirationMs) && expirationMs - Date.now() > 60_000;
}

function getValidStoredTicket(storedTicket: any, bucket: 'wsfe' | 'padron'): any | null {
  const ticket = readArcaTicketBucket(storedTicket, bucket);
  return isStoredTicketValid(ticket) ? ticket : null;
}

async function persistTicketFromFile(params: {
  supabase: any;
  contribuyenteId: string;
  currentTicket: any;
  cuit: number;
  production: boolean;
}): Promise<void> {
  try {
    const filePath = getTicketFilePath(params.cuit, WSFE_SERVICE_NAME, params.production);
    const fileData = await Deno.readTextFile(filePath);
    const ticket = JSON.parse(fileData);

    if (!isStoredTicketValid(ticket)) return;

    const nextTicket = writeArcaTicketBucket(params.currentTicket, 'wsfe', ticket);
    const { error } = await params.supabase
      .from('contribuyentes')
      .update({ arca_ticket: nextTicket })
      .eq('id', params.contribuyenteId);

    if (error) {
      console.error('No se pudo guardar el ticket WSFE en Supabase:', error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('No such file') && !message.includes('os error 2')) {
      console.error('No se pudo leer el ticket WSFE temporal:', message);
    }
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
      Number.isInteger(body?.doc_tipo) ? Number(body.doc_tipo) : 99,
    ),
  };
}

function parseLastVoucherNumber(lastVoucher: any): number {
  const lastNumber =
    typeof lastVoucher === 'number'
      ? lastVoucher
      : lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0;

  return Number.isFinite(Number(lastNumber)) ? Number(lastNumber) : 0;
}

function getLastVoucherCacheCutoffIso(): string {
  return new Date(Date.now() - LAST_VOUCHER_CACHE_TTL_MS).toISOString();
}

function logArcaProxy(event: string, data: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      scope: 'arca-proxy',
      event,
      at: new Date().toISOString(),
      ...data,
    }),
  );
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
  const errors =
    payload?.FECAESolicitarResult?.Errors?.Err ?? payload?.Errors?.Err ?? payload?.errors ?? [];
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

function mapArcaServerErrorMessage(message: string): string {
  if (!message) {
    return 'Error desconocido en ARCA.';
  }

  if (message.includes('ns1:coe.alreadyAuthenticated')) {
    return 'ARCA ya tiene un TA valido para WSFE en este CUIT. Suele pasar cuando existe un ticket activo en homologacion y se intento autenticar de nuevo. Espera unos minutos y reintenta.';
  }

  return message;
}

function normalizeErrorText(message: string): string {
  return message
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function classifyArcaError(message: string): ArcaProxyErrorType {
  const normalizedMessage = normalizeErrorText(message);

  if (
    normalizedMessage.includes('mantenimiento') ||
    normalizedMessage.includes('maintenance') ||
    normalizedMessage.includes('service unavailable') ||
    normalizedMessage.includes('temporarily unavailable')
  ) {
    return 'arca_maintenance';
  }

  if (
    normalizedMessage.includes('wsaa') ||
    normalizedMessage.includes('autenticacion') ||
    normalizedMessage.includes('alreadyauthenticated') ||
    normalizedMessage.includes('credentials') ||
    normalizedMessage.includes('credenciales') ||
    normalizedMessage.includes('certificado') ||
    normalizedMessage.includes('token') ||
    normalizedMessage.includes('sesion') ||
    normalizedMessage.includes('session')
  ) {
    return 'arca_auth';
  }

  if (
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('econnreset') ||
    normalizedMessage.includes('etimedout') ||
    normalizedMessage.includes('connection') ||
    normalizedMessage.includes('socket') ||
    normalizedMessage.includes('dns')
  ) {
    return 'network';
  }

  if (normalizedMessage.includes('validacion fallida')) {
    return 'validation';
  }

  return 'server';
}

function isNumberingRejection(parsed: ReturnType<typeof extractWsfeResult>, message: string) {
  const details = [
    message,
    ...parsed.errors.map((err: any) => `${err.Code || err.code || ''} ${err.Msg || err.msg || ''}`),
    ...parsed.observations.map(
      (obs: any) => `${obs.Code || obs.code || ''} ${obs.Msg || obs.msg || ''}`,
    ),
    summarizeUnknownResult(parsed.raw),
  ].join(' ');
  const normalizedDetails = normalizeErrorText(details);

  return (
    normalizedDetails.includes('proximo a autorizar') ||
    normalizedDetails.includes('ultimo autorizado') ||
    normalizedDetails.includes('ya fue autorizado') ||
    normalizedDetails.includes('comprobante ya existe') ||
    normalizedDetails.includes('comprobante duplicado') ||
    (normalizedDetails.includes('numero') &&
      normalizedDetails.includes('comprobante') &&
      normalizedDetails.includes('autorizar'))
  );
}

async function getCachedLastVoucher(params: {
  supabase: any;
  contribuyenteId: string;
  puntoVenta: number;
  tipoComprobante: string;
  cbteTipo: number;
}): Promise<number | null> {
  const { data, error } = await params.supabase
    .from('ultimo_comprobante_cache')
    .select('ultimo_comprobante, synced_at')
    .eq('contribuyente_id', params.contribuyenteId)
    .eq('punto_venta', params.puntoVenta)
    .eq('tipo_comprobante', params.tipoComprobante)
    .eq('cbte_tipo', params.cbteTipo)
    .gte('synced_at', getLastVoucherCacheCutoffIso())
    .maybeSingle();

  if (error) {
    console.error('No se pudo leer cache de ultimo comprobante:', error.message);
    return null;
  }

  const cachedNumber = Number(data?.ultimo_comprobante);
  return Number.isFinite(cachedNumber) ? cachedNumber : null;
}

async function upsertLastVoucherCache(params: {
  supabase: any;
  contribuyenteId: string;
  puntoVenta: number;
  tipoComprobante: string;
  cbteTipo: number;
  ultimoComprobante: number;
}): Promise<void> {
  const { error } = await params.supabase.from('ultimo_comprobante_cache').upsert(
    {
      contribuyente_id: params.contribuyenteId,
      punto_venta: params.puntoVenta,
      tipo_comprobante: params.tipoComprobante,
      cbte_tipo: params.cbteTipo,
      ultimo_comprobante: params.ultimoComprobante,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'contribuyente_id,punto_venta,tipo_comprobante' },
  );

  if (error) {
    console.error('No se pudo guardar cache de ultimo comprobante:', error.message);
  }
}

async function fetchAndCacheLastVoucher(params: {
  arca: any;
  persistTicket: () => Promise<void>;
  supabase: any;
  contribuyenteId: string;
  puntoVenta: number;
  tipoComprobante: string;
  cbteTipo: number;
}): Promise<number> {
  const startedAt = Date.now();
  const lastVoucher = await params.arca.electronicBillingService.getLastVoucher(
    params.puntoVenta,
    params.cbteTipo,
  );
  await params.persistTicket();
  const ultimoComprobante = parseLastVoucherNumber(lastVoucher);
  logArcaProxy('last_voucher_fetch', {
    contribuyenteId: params.contribuyenteId,
    puntoVenta: params.puntoVenta,
    tipoComprobante: params.tipoComprobante,
    cbteTipo: params.cbteTipo,
    ultimoComprobante,
    durationMs: Date.now() - startedAt,
  });
  await upsertLastVoucherCache({
    supabase: params.supabase,
    contribuyenteId: params.contribuyenteId,
    puntoVenta: params.puntoVenta,
    tipoComprobante: params.tipoComprobante,
    cbteTipo: params.cbteTipo,
    ultimoComprobante,
  });

  return ultimoComprobante;
}

function getArcaRejectionError(parsed: ReturnType<typeof extractWsfeResult>) {
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
  const detalle = [detalleErrores, detalleObservaciones, detalleEventos]
    .filter(Boolean)
    .join(' | ');
  const errorMessage = detalle
    ? `Error AFIP (${parsed.resultado || 'sin resultado'}): ${detalle}`
    : rawSummary
      ? `Error AFIP: respuesta no reconocida (${parsed.resultado || 'sin resultado'}). Raw: ${rawSummary}`
      : `Error AFIP: La solicitud fue rechazada por AFIP (Resultado: ${parsed.resultado || 'sin resultado'})`;

  return {
    errorMessage,
    debug: {
      afipResponse: parsed.resultado,
      errores: detalleErrores,
      observaciones: detalleObservaciones,
      eventos: detalleEventos,
      rawSummary,
      raw: parsed.raw,
    },
  };
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

  const cuit = parseInt(contribuyente.cuit, 10);
  const production = contribuyente.arca_production === true;
  const credentials = getValidStoredTicket(contribuyente.arca_ticket, 'wsfe');
  const arca = new Arca({
    cert: contribuyente.arca_cert,
    key: contribuyente.arca_key,
    cuit,
    production,
    credentials: credentials || undefined,
    handleTicket: !!credentials,
    useHttpsAgent: false,
    ticketPath: ARCA_TICKET_PATH,
  });

  return {
    supabase: supabaseUser,
    contribuyenteId: contribuyente.id,
    arca,
    persistTicket: () =>
      persistTicketFromFile({
        supabase: supabaseUser,
        contribuyenteId: contribuyente.id,
        currentTicket: contribuyente.arca_ticket,
        cuit,
        production,
      }),
  };
}

function buildErrorResponse(
  errorMessage: string,
  extra?: Record<string, unknown>,
  status = 400,
  errorType?: ArcaProxyErrorType,
) {
  const resolvedErrorType = errorType || classifyArcaError(errorMessage);
  const shouldRetry = resolvedErrorType === 'arca_maintenance' || resolvedErrorType === 'network';

  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      error_type: resolvedErrorType,
      should_retry: shouldRetry,
      ...extra,
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

/**
 * Contrato operativo: emite una factura autorizada por ARCA para el contribuyente autenticado.
 * Requiere JWT valido, contribuyente existente, certificados cargados y bucket `wsfe` operativo.
 * Responde `success/data` en altas autorizadas y `success/error` para validacion, rechazo AFIP o error interno.
 */
async function handleCrearFactura(req: Request, body: any): Promise<Response> {
  const { punto_venta, tipo_comprobante, monto, fecha, concepto_afip, iva_porcentaje } = body;
  const { docTipo, docNro, condicionIvaReceptorId } = getDocPayload(body);

  try {
    if (!punto_venta || !Number.isInteger(punto_venta) || punto_venta <= 0) {
      return buildErrorResponse(
        'Validacion fallida: punto_venta debe ser un numero entero positivo',
      );
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

    const { arca, persistTicket, supabase, contribuyenteId } = await getUserArcaInstance(req);
    const cbteTipo = getCbteTipo(tipo_comprobante);
    const normalizedTipoComprobante = String(tipo_comprobante).toUpperCase();
    const cachedLastNumber = await getCachedLastVoucher({
      supabase,
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
    });
    logArcaProxy('crear_factura_last_voucher_source', {
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
      source: cachedLastNumber === null ? 'arca' : 'cache',
      cachedLastNumber,
    });
    const lastNumber =
      cachedLastNumber ??
      (await fetchAndCacheLastVoucher({
        arca,
        persistTicket,
        supabase,
        contribuyenteId,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
      }));
    let cbteNro = lastNumber + 1;

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

    let createStartedAt = Date.now();
    let parsed = extractWsfeResult(
      await arca.electronicBillingService.createVoucher(voucherPayload),
    );
    await persistTicket();
    logArcaProxy('create_voucher_result', {
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
      cbteNro,
      resultado: parsed.resultado,
      durationMs: Date.now() - createStartedAt,
      retry: false,
    });

    if (parsed.resultado !== 'A') {
      const rejected = getArcaRejectionError(parsed);

      if (isNumberingRejection(parsed, rejected.errorMessage)) {
        logArcaProxy('numbering_rejection_retry', {
          contribuyenteId,
          puntoVenta: punto_venta,
          tipoComprobante: normalizedTipoComprobante,
          cbteTipo,
          attemptedCbteNro: cbteNro,
          errorMessage: rejected.errorMessage,
        });
        const refreshedLastNumber = await fetchAndCacheLastVoucher({
          arca,
          persistTicket,
          supabase,
          contribuyenteId,
          puntoVenta: punto_venta,
          tipoComprobante: normalizedTipoComprobante,
          cbteTipo,
        });
        cbteNro = refreshedLastNumber + 1;
        voucherPayload.CbteDesde = cbteNro;
        voucherPayload.CbteHasta = cbteNro;
        createStartedAt = Date.now();
        parsed = extractWsfeResult(
          await arca.electronicBillingService.createVoucher(voucherPayload),
        );
        await persistTicket();
        logArcaProxy('create_voucher_result', {
          contribuyenteId,
          puntoVenta: punto_venta,
          tipoComprobante: normalizedTipoComprobante,
          cbteTipo,
          cbteNro,
          resultado: parsed.resultado,
          durationMs: Date.now() - createStartedAt,
          retry: true,
        });
      }
    }

    if (parsed.resultado !== 'A') {
      const rejected = getArcaRejectionError(parsed);

      return buildErrorResponse(
        rejected.errorMessage,
        { debug: rejected.debug },
        400,
        'arca_rejected',
      );
    }

    await upsertLastVoucherCache({
      supabase,
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
      ultimoComprobante: Number(parsed.cbteDesde || cbteNro),
    });
    logArcaProxy('last_voucher_cache_updated_after_authorization', {
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
      ultimoComprobante: Number(parsed.cbteDesde || cbteNro),
    });

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    const detail = mapArcaServerErrorMessage(rawMessage);
    return buildErrorResponse(
      `Error del servidor: ${detail}`,
      { debug: { detalle: err.message } },
      500,
      classifyArcaError(rawMessage || detail),
    );
  }
}

/**
 * Contrato operativo: genera una nota de credito asociada a un comprobante previo.
 * Mantiene el mismo contexto autenticado del emisor y persiste numeracion segun WSFE.
 * La respuesta replica el shape de `crear-factura` para simplificar el adaptador frontend.
 */
async function handleCrearNotaCredito(req: Request, body: any): Promise<Response> {
  try {
    const { arca, persistTicket } = await getUserArcaInstance(req);
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
      return buildErrorResponse(
        'Validacion fallida: punto_venta debe ser un numero entero positivo',
      );
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
        'Validacion fallida: cbte_asociado_nro debe ser un numero entero positivo',
      );
    }

    if (!cbte_asociado_fecha || !/^\d{8}$/.test(String(cbte_asociado_fecha))) {
      return buildErrorResponse(
        'Validacion fallida: cbte_asociado_fecha debe estar en formato YYYYMMDD',
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
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(
      punto_venta,
      cbteTipo,
    );
    await persistTicket();
    const lastNumber =
      typeof lastVoucher === 'number'
        ? lastVoucher
        : lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0;
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

    const parsed = extractWsfeResult(
      await arca.electronicBillingService.createVoucher(voucherPayload),
    );
    await persistTicket();

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
      const detalle = [detalleErrores, detalleObservaciones, detalleEventos]
        .filter(Boolean)
        .join(' | ');
      const errorMessage = detalle
        ? `Error AFIP (${parsed.resultado || 'sin resultado'}): ${detalle}`
        : rawSummary
          ? `Error AFIP: respuesta no reconocida (${parsed.resultado || 'sin resultado'}). Raw: ${rawSummary}`
          : `Error AFIP: La solicitud fue rechazada por AFIP (Resultado: ${parsed.resultado || 'sin resultado'})`;

      return buildErrorResponse(
        errorMessage,
        {
          debug: {
            afipResponse: parsed.resultado,
            errores: detalleErrores,
            observaciones: detalleObservaciones,
            eventos: detalleEventos,
            rawSummary,
            raw: parsed.raw,
          },
        },
        400,
        'arca_rejected',
      );
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    const detail = mapArcaServerErrorMessage(rawMessage);
    return buildErrorResponse(
      `Error del servidor: ${detail}`,
      { debug: { detalle: err.message } },
      500,
      classifyArcaError(rawMessage || detail),
    );
  }
}

/**
 * Contrato operativo: consulta el ultimo numero emitido para un punto de venta y tipo de comprobante.
 * Se usa como lectura administrativa y no persiste cambios locales salvo renovacion de ticket WSFE.
 */
async function handleUltimoComprobante(req: Request, body: any): Promise<Response> {
  try {
    const { arca, persistTicket } = await getUserArcaInstance(req);
    const { punto_venta, tipo_comprobante } = body;
    const lastVoucher: any = await arca.electronicBillingService.getLastVoucher(
      punto_venta,
      getCbteTipo(tipo_comprobante),
    );
    await persistTicket();
    const ultimoCbteNro = parseLastVoucherNumber(lastVoucher);

    return new Response(
      JSON.stringify({ success: true, data: { ultimo_comprobante: ultimoCbteNro } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Precarga el ultimo numero autorizado para reducir latencia en la emision siguiente.
 * Si hay cache fresca, evita ARCA; si no, consulta `getLastVoucher` y renueva ticket WSFE.
 */
async function handlePrecalentarUltimoComprobante(req: Request, body: any): Promise<Response> {
  try {
    const { arca, persistTicket, supabase, contribuyenteId } = await getUserArcaInstance(req);
    const { punto_venta, tipo_comprobante } = body;

    if (!punto_venta || !Number.isInteger(punto_venta) || punto_venta <= 0) {
      return buildErrorResponse(
        'Validacion fallida: punto_venta debe ser un numero entero positivo',
      );
    }

    if (!tipo_comprobante || typeof tipo_comprobante !== 'string') {
      return buildErrorResponse('Validacion fallida: tipo_comprobante es requerido');
    }

    const cbteTipo = getCbteTipo(tipo_comprobante);
    const normalizedTipoComprobante = String(tipo_comprobante).toUpperCase();
    const cachedLastNumber = await getCachedLastVoucher({
      supabase,
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
    });

    if (cachedLastNumber !== null) {
      logArcaProxy('prefetch_last_voucher_cache_hit', {
        contribuyenteId,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        ultimoComprobante: cachedLastNumber,
      });
      return new Response(
        JSON.stringify({
          success: true,
          data: { ultimo_comprobante: cachedLastNumber, cache_hit: true },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const ultimoComprobante = await fetchAndCacheLastVoucher({
      arca,
      persistTicket,
      supabase,
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
    });
    logArcaProxy('prefetch_last_voucher_cache_miss', {
      contribuyenteId,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
      ultimoComprobante,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: { ultimo_comprobante: ultimoComprobante, cache_hit: false },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    const detail = mapArcaServerErrorMessage(rawMessage);
    return buildErrorResponse(
      `Error del servidor: ${detail}`,
      { debug: { detalle: err.message } },
      500,
      classifyArcaError(rawMessage || detail),
    );
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
      case 'precalentar-ultimo-comprobante':
        return await handlePrecalentarUltimoComprobante(req, body);
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
