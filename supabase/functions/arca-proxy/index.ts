import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessTicket, Arca } from 'npm:@arcasdk/core@2.0.0';
import { corsHeaders, RequestTimings } from '../_shared/http-observability.ts';
import { getVerifiedUserId } from '../_shared/supabase-auth.ts';
import { SupabaseArcaTicketStorage } from '../_shared/arca-ticket-storage.ts';
import { getEmissionTimingSnapshot } from '../_shared/arca-emission-timing.ts';
import { normalizeVoucherInfo, voucherMatchesExpected } from '../_shared/arca-voucher.ts';
import { verifyAndLoadContext } from '../_shared/parallel-context.ts';

const WSFE_SERVICE_NAME = 'wsfe';
const LAST_VOUCHER_CACHE_TTL_MS = 15 * 60 * 1000;

type ArcaProxyErrorType =
  | 'arca_maintenance'
  | 'arca_auth'
  | 'network'
  | 'arca_rejected'
  | 'validation'
  | 'server';

function measureStage<T>(
  timings: RequestTimings | undefined,
  name: string,
  operation: () => PromiseLike<T>,
): Promise<T> {
  return timings
    ? timings.measure(name, async () => await operation())
    : Promise.resolve(operation());
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

async function getAuthenticatedUser(req: Request, timings?: RequestTimings) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No autorizado');

  const supabase = getSupabaseClient(authHeader);
  const token = authHeader.replace('Bearer ', '').trim();
  const authenticate = () => getVerifiedUserId(supabase.auth, token);
  const userId = timings ? await timings.measure('auth', authenticate) : await authenticate();

  return { supabase, user: { id: userId } };
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

function finalizeTimedResponse(
  response: Response,
  timings: RequestTimings,
  action: string | null,
): Response {
  response.headers.set('Server-Timing', timings.toServerTimingHeader());
  logArcaProxy('request_timing', {
    action: action || 'unknown',
    status: response.status,
    timings: timings.toJSON(),
  });
  return response;
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
  timings?: RequestTimings;
}): Promise<number> {
  const startedAt = Date.now();
  const lastVoucher = await measureStage(params.timings, 'arca_last_voucher', () =>
    params.arca.electronicBillingService.getLastVoucher(params.puntoVenta, params.cbteTipo),
  );
  await measureStage(params.timings, 'ticket_persist', params.persistTicket);
  const ultimoComprobante = parseLastVoucherNumber(lastVoucher);
  logArcaProxy('last_voucher_fetch', {
    contribuyenteId: params.contribuyenteId,
    puntoVenta: params.puntoVenta,
    tipoComprobante: params.tipoComprobante,
    cbteTipo: params.cbteTipo,
    ultimoComprobante,
    durationMs: Date.now() - startedAt,
  });
  await measureStage(params.timings, 'cache_write', () =>
    upsertLastVoucherCache({
      supabase: params.supabase,
      contribuyenteId: params.contribuyenteId,
      puntoVenta: params.puntoVenta,
      tipoComprobante: params.tipoComprobante,
      cbteTipo: params.cbteTipo,
      ultimoComprobante,
    }),
  );

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

function buildUserArcaInstance(supabaseUser: any, contribuyente: any) {
  if (!contribuyente) throw new Error('No se encontro el contribuyente');
  if (!contribuyente.arca_cert || !contribuyente.arca_key) {
    throw new Error('Certificados no configurados');
  }

  const cuit = parseInt(contribuyente.cuit, 10);
  const production = contribuyente.arca_production === true;
  const ticketStorage = new SupabaseArcaTicketStorage(
    supabaseUser,
    'wsfe',
    contribuyente.arca_ticket,
    AccessTicket,
  );
  const arca = new Arca({
    cert: contribuyente.arca_cert,
    key: contribuyente.arca_key,
    cuit,
    production,
    ticketStorage,
    useHttpsAgent: false,
  });

  return {
    supabase: supabaseUser,
    contribuyenteId: contribuyente.id,
    arcaEnvironment: production ? 'produccion' : 'homologacion',
    arca,
    persistTicket: async () => {},
  };
}

async function getUserArcaInstance(req: Request, timings?: RequestTimings) {
  const { supabase: supabaseUser, user } = await getAuthenticatedUser(req, timings);

  const loadContribuyente = () =>
    supabaseUser
      .from('contribuyentes')
      .select('id, cuit, arca_cert, arca_key, arca_production, arca_ticket')
      .eq('user_id', user.id)
      .single();
  const { data: contribuyente, error } = await measureStage(
    timings,
    'contribuyente_db',
    loadContribuyente,
  );

  if (error) throw new Error(error.message || 'No se pudo obtener el contribuyente');
  return buildUserArcaInstance(supabaseUser, contribuyente);
}

async function getUserArcaInvoiceContext(params: {
  req: Request;
  puntoVenta: number;
  tipoComprobante: string;
  cbteTipo: number;
  timings?: RequestTimings;
}) {
  const authHeader = params.req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No autorizado');

  const supabaseUser = getSupabaseClient(authHeader);
  const token = authHeader.replace('Bearer ', '').trim();
  const loadContext = () =>
    supabaseUser
      .rpc('get_arca_invoice_context', {
        p_punto_venta: params.puntoVenta,
        p_tipo_comprobante: params.tipoComprobante,
        p_cbte_tipo: params.cbteTipo,
        p_cache_cutoff: getLastVoucherCacheCutoffIso(),
      })
      .single();
  const { context: contextResult } = await measureStage(
    params.timings,
    'context_prepare',
    () =>
      verifyAndLoadContext(
        () =>
          measureStage(params.timings, 'auth', () =>
            getVerifiedUserId(supabaseUser.auth, token),
          ),
        () => measureStage(params.timings, 'invoice_context_db', loadContext),
      ),
  );
  const { data: contextData, error } = contextResult;

  if (error) throw new Error(error.message || 'No se pudo obtener el contexto de facturacion');
  const context: any = contextData;
  const arcaInstance = buildUserArcaInstance(supabaseUser, {
    id: context?.contribuyente_id,
    cuit: context?.cuit,
    arca_cert: context?.arca_cert,
    arca_key: context?.arca_key,
    arca_production: context?.arca_production,
    arca_ticket: context?.arca_ticket,
  });
  const cachedNumber =
    context?.ultimo_comprobante == null ? null : Number(context.ultimo_comprobante);

  return {
    ...arcaInstance,
    cachedLastNumber: cachedNumber !== null && Number.isFinite(cachedNumber) ? cachedNumber : null,
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

async function updateEmissionStatus(
  supabase: any,
  emisionId: string,
  values: Record<string, unknown>,
  timings?: RequestTimings,
): Promise<void> {
  const timingSnapshot = getEmissionTimingSnapshot(timings);
  const { error } = await supabase
    .from('arca_emisiones')
    .update({
      ...values,
      ...(timingSnapshot ? { request_timings: timingSnapshot } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', emisionId);
  if (error) throw new Error(`No se pudo actualizar el intento de emision: ${error.message}`);
}

async function loadPersistedEmission(supabase: any, emisionId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('comprobantes')
    .select('*')
    .eq('emision_id', emisionId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo consultar la emision existente: ${error.message}`);
  return data ?? null;
}

async function registerEmissionAttempt(params: {
  supabase: any;
  emisionId: string;
  contribuyenteId: string;
  arcaEnvironment: string;
  puntoVenta: number;
  tipoComprobante: string;
  cbteTipo: number;
  cbteNro: number;
  requestPayload: Record<string, unknown>;
}): Promise<{ existing: boolean; attempt: any; comprobante?: any }> {
  const sameRequest = (stored: any) =>
    [
      'fecha',
      'monto',
      'doc_tipo',
      'doc_nro',
      'concepto_afip',
      'iva_porcentaje',
      'condicion_iva_receptor_id',
    ].every((key) => String(stored?.[key] ?? '') === String(params.requestPayload[key] ?? ''));
  const { data: existing, error: lookupError } = await params.supabase
    .from('arca_emisiones')
    .select('*')
    .eq('id', params.emisionId)
    .maybeSingle();
  if (lookupError) throw new Error(`No se pudo consultar el intento de emision: ${lookupError.message}`);

  if (existing) {
    if (existing.contribuyente_id !== params.contribuyenteId) {
      throw new Error('El identificador de emision pertenece a otro contribuyente');
    }
    if (!sameRequest(existing.request_payload)) {
      throw new Error('El identificador de emision fue reutilizado con un payload diferente');
    }
    if (existing.status === 'persisted') {
      const comprobante = await loadPersistedEmission(params.supabase, params.emisionId);
      if (comprobante) return { existing: true, attempt: existing, comprobante };
    }
    return { existing: true, attempt: existing };
  }

  const attempt = {
    id: params.emisionId,
    contribuyente_id: params.contribuyenteId,
    arca_environment: params.arcaEnvironment,
    punto_venta: params.puntoVenta,
    tipo_comprobante: params.tipoComprobante,
    cbte_tipo: params.cbteTipo,
    cbte_nro: params.cbteNro,
    request_payload: params.requestPayload,
    status: 'pending',
  };
  const { error: insertError } = await params.supabase.from('arca_emisiones').insert(attempt);
  if (insertError?.code === '23505') {
    const { data: racedAttempt, error: racedError } = await params.supabase
      .from('arca_emisiones')
      .select('*')
      .eq('id', params.emisionId)
      .single();
    if (racedError || !sameRequest(racedAttempt?.request_payload)) {
      throw new Error('El identificador de emision ya existe con otro payload');
    }
    return { existing: true, attempt: racedAttempt };
  }
  if (insertError) throw new Error(`No se pudo registrar el intento de emision: ${insertError.message}`);
  return { existing: false, attempt };
}

async function queryVoucherInfo(arca: any, cbteNro: number, puntoVenta: number, cbteTipo: number) {
  try {
    const raw = await arca.electronicBillingService.getVoucherInfo(
      cbteNro,
      puntoVenta,
      cbteTipo,
    );
    return { raw, voucher: normalizeVoucherInfo(raw) };
  } catch (error) {
    const message = normalizeErrorText(error instanceof Error ? error.message : String(error));
    if (message.includes('no existe') || message.includes('no encontrado') || message.includes('602')) {
      return { raw: null, voucher: null };
    }
    throw error;
  }
}

async function finalizeAuthorizedEmission(params: {
  supabase: any;
  emisionId: string;
  cbteNro: number;
  cae: string;
  caeFchVto: string;
  arcaPayload: any;
  recovered: boolean;
  timings?: RequestTimings;
}): Promise<any> {
  const { data, error } = await params.supabase.rpc('finalize_arca_emission', {
      p_emision_id: params.emisionId,
      p_cbte_nro: params.cbteNro,
      p_cae: params.cae,
      p_vencimiento_cae: params.caeFchVto,
      p_arca_payload: params.arcaPayload,
      p_recovered: params.recovered,
      p_request_timings: getEmissionTimingSnapshot(params.timings),
    });
  if (error) throw new Error(`ARCA autorizo pero no se pudo persistir el comprobante: ${error.message}`);
  return data;
}

function successEmissionResponse(comprobante: any, recovered = false): Response {
  return new Response(JSON.stringify({ success: true, data: { comprobante, recovered } }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Contrato operativo: emite una factura autorizada por ARCA para el contribuyente autenticado.
 * Requiere JWT valido, contribuyente existente, certificados cargados y bucket `wsfe` operativo.
 * Responde `success/data` en altas autorizadas y `success/error` para validacion, rechazo AFIP o error interno.
 */
async function handleCrearFacturaLegacy(
  req: Request,
  body: any,
  timings?: RequestTimings,
): Promise<Response> {
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

    const cbteTipo = getCbteTipo(tipo_comprobante);
    const normalizedTipoComprobante = String(tipo_comprobante).toUpperCase();
    const { arca, persistTicket, supabase, contribuyenteId, cachedLastNumber } =
      await getUserArcaInvoiceContext({
        req,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        timings,
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
        timings,
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
      await measureStage(timings, 'arca_create', () =>
        arca.electronicBillingService.createVoucher(voucherPayload),
      ),
    );
    await measureStage(timings, 'ticket_persist', persistTicket);
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
          timings,
        });
        cbteNro = refreshedLastNumber + 1;
        voucherPayload.CbteDesde = cbteNro;
        voucherPayload.CbteHasta = cbteNro;
        createStartedAt = Date.now();
        parsed = extractWsfeResult(
          await measureStage(timings, 'arca_create', () =>
            arca.electronicBillingService.createVoucher(voucherPayload),
          ),
        );
        await measureStage(timings, 'ticket_persist', persistTicket);
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

    await measureStage(timings, 'cache_write', () =>
      upsertLastVoucherCache({
        supabase,
        contribuyenteId,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        ultimoComprobante: Number(parsed.cbteDesde || cbteNro),
      }),
    );
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

async function handleCrearFactura(
  req: Request,
  body: any,
  timings?: RequestTimings,
): Promise<Response> {
  if (!body?.emision_id) {
    logArcaProxy('legacy_invoice_client', { reason: 'missing_emision_id' });
    return handleCrearFacturaLegacy(req, body, timings);
  }

  const { punto_venta, tipo_comprobante, monto, fecha, concepto_afip, iva_porcentaje } = body;
  const { docTipo, docNro, condicionIvaReceptorId } = getDocPayload(body);

  try {
    if (!punto_venta || !Number.isInteger(punto_venta) || punto_venta <= 0) {
      return buildErrorResponse('Validacion fallida: punto_venta debe ser un entero positivo');
    }
    if (!tipo_comprobante || typeof tipo_comprobante !== 'string') {
      return buildErrorResponse('Validacion fallida: tipo_comprobante es requerido');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.emision_id ?? ''))) {
      return buildErrorResponse('Validacion fallida: emision_id debe ser un UUID');
    }
    const montoTotal = Number(monto);
    if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
      return buildErrorResponse('Validacion fallida: monto debe ser un numero positivo');
    }
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
      return buildErrorResponse('Validacion fallida: fecha debe estar en formato YYYY-MM-DD');
    }

    const cbteTipo = getCbteTipo(tipo_comprobante);
    const normalizedTipoComprobante = String(tipo_comprobante).toUpperCase();
    const context = await getUserArcaInvoiceContext({
      req,
      puntoVenta: punto_venta,
      tipoComprobante: normalizedTipoComprobante,
      cbteTipo,
      timings,
    });
    const { arca, supabase, contribuyenteId, cachedLastNumber, arcaEnvironment } = context;

    const isFacturaC = normalizedTipoComprobante === 'FACTURA C';
    const ivaPct = Number(iva_porcentaje) || 21;
    const impNeto = isFacturaC
      ? montoTotal
      : Number((montoTotal / (1 + ivaPct / 100)).toFixed(2));
    const impIVA = isFacturaC ? 0 : Number((montoTotal - impNeto).toFixed(2));
    const conceptoNum = Number(concepto_afip) || 2;
    const fechaNum = Number(String(fecha).replace(/-/g, ''));
    const lastNumber =
      cachedLastNumber ??
      (await fetchAndCacheLastVoucher({
        ...context,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        timings,
      }));
    let cbteNro = lastNumber + 1;

    const requestPayload = {
      fecha,
      monto: montoTotal,
      concepto: body.concepto ?? null,
      doc_tipo: docTipo,
      doc_nro: docNro,
      cliente_cuit: body.cliente_cuit ?? null,
      cliente_nombre: body.cliente_nombre ?? null,
      cliente_domicilio: body.cliente_domicilio ?? null,
      cliente_condicion_iva: body.cliente_condicion_iva ?? null,
      concepto_afip: conceptoNum,
      iva_porcentaje: ivaPct,
      condicion_iva_receptor_id: condicionIvaReceptorId,
    };
    const registration = await measureStage(timings, 'attempt_write', () =>
      registerEmissionAttempt({
        supabase,
        emisionId: body.emision_id,
        contribuyenteId,
        arcaEnvironment,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        cbteNro,
        requestPayload,
      }),
    );
    if (registration.comprobante) return successEmissionResponse(registration.comprobante);
    if (registration.attempt.status === 'conflict') {
      return buildErrorResponse('La emision esta en conflicto con un comprobante existente en ARCA', {}, 409, 'arca_rejected');
    }
    cbteNro = Number(registration.attempt.cbte_nro ?? cbteNro);

    const buildVoucherPayload = (number: number) => {
      const payload: any = {
        CantReg: 1,
        PtoVta: punto_venta,
        CbteTipo: cbteTipo,
        Concepto: conceptoNum,
        DocTipo: docTipo,
        DocNro: docNro,
        CondicionIVAReceptorId: condicionIvaReceptorId,
        CbteDesde: number,
        CbteHasta: number,
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
      if (!isFacturaC) payload.Iva = [{ Id: getIvaId(ivaPct), BaseImp: impNeto, Importe: impIVA }];
      if (conceptoNum >= 2) {
        payload.FchServDesde = fechaNum;
        payload.FchServHasta = fechaNum;
        payload.FchVtoPago = fechaNum;
      }
      return payload;
    };
    const expectedFor = (number: number) => ({
      concepto: conceptoNum,
      docTipo,
      docNro,
      cbteNro: number,
      cbteFch: fechaNum,
      impTotal: montoTotal,
      monId: 'PES',
      monCotiz: 1,
    });
    const recover = async (number: number) => {
      const info = await measureStage(timings, 'arca_voucher_info', () =>
        queryVoucherInfo(arca, number, punto_venta, cbteTipo),
      );
      return { ...info, matches: voucherMatchesExpected(info.voucher, expectedFor(number)) };
    };
    const finalizeRecovered = async (number: number, recovery: any) => {
      const comprobante = await finalizeAuthorizedEmission({
        supabase,
        emisionId: body.emision_id,
        cbteNro: number,
        cae: String(recovery.voucher.codAutorizacion ?? ''),
        caeFchVto: String(recovery.voucher.fchVto ?? ''),
        arcaPayload: recovery.raw,
        recovered: true,
        timings,
      });
      return successEmissionResponse(comprobante, true);
    };

    if (registration.existing && ['pending', 'uncertain', 'authorized'].includes(registration.attempt.status)) {
      const recovery = await recover(cbteNro);
      if (recovery.matches) return finalizeRecovered(cbteNro, recovery);
      if (recovery.voucher) {
        await updateEmissionStatus(
          supabase,
          body.emision_id,
          {
            status: 'conflict',
            arca_response: recovery.raw,
            error_message: 'El numero intentado pertenece a otro payload',
          },
          timings,
        );
        return buildErrorResponse('El numero intentado ya corresponde a otro comprobante en ARCA', {}, 409, 'arca_rejected');
      }
    }

    let parsed: ReturnType<typeof extractWsfeResult>;
    let rawCreateResult: any;
    const create = async () => {
      rawCreateResult = await measureStage(timings, 'arca_create', () =>
        arca.electronicBillingService.createVoucher(buildVoucherPayload(cbteNro)),
      );
      parsed = extractWsfeResult(rawCreateResult);
      return parsed;
    };

    try {
      await create();
    } catch (error) {
      const recovery = await recover(cbteNro);
      if (recovery.matches) return finalizeRecovered(cbteNro, recovery);
      await updateEmissionStatus(
        supabase,
        body.emision_id,
        {
          status: recovery.voucher ? 'conflict' : 'uncertain',
          arca_response: recovery.raw,
          error_message: error instanceof Error ? error.message : String(error),
        },
        timings,
      );
      if (recovery.voucher) {
        return buildErrorResponse('ARCA tiene otro comprobante para el numero intentado', {}, 409, 'arca_rejected');
      }
      throw error;
    }

    if (parsed!.resultado !== 'A' && isNumberingRejection(parsed!, getArcaRejectionError(parsed!).errorMessage)) {
      const recovery = await recover(cbteNro);
      if (recovery.matches) return finalizeRecovered(cbteNro, recovery);

      const refreshedLastNumber = await fetchAndCacheLastVoucher({
        ...context,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        timings,
      });
      cbteNro = refreshedLastNumber + 1;
      await updateEmissionStatus(
        supabase,
        body.emision_id,
        { cbte_nro: cbteNro, status: 'pending' },
        timings,
      );
      try {
        await create();
      } catch (error) {
        const retryRecovery = await recover(cbteNro);
        if (retryRecovery.matches) return finalizeRecovered(cbteNro, retryRecovery);
        await updateEmissionStatus(
          supabase,
          body.emision_id,
          {
            status: retryRecovery.voucher ? 'conflict' : 'uncertain',
            arca_response: retryRecovery.raw,
            error_message: error instanceof Error ? error.message : String(error),
          },
          timings,
        );
        throw error;
      }
    }

    if (parsed!.resultado !== 'A') {
      const rejected = getArcaRejectionError(parsed!);
      await updateEmissionStatus(
        supabase,
        body.emision_id,
        {
          status: 'rejected',
          arca_response: parsed!.raw,
          error_message: rejected.errorMessage,
        },
        timings,
      );
      return buildErrorResponse(rejected.errorMessage, { debug: rejected.debug }, 400, 'arca_rejected');
    }

    const authorizedNumber = Number(parsed!.cbteDesde || cbteNro);
    const comprobante = await finalizeAuthorizedEmission({
      supabase,
      emisionId: body.emision_id,
      cbteNro: authorizedNumber,
      cae: String(parsed!.cae ?? ''),
      caeFchVto: String(parsed!.caeFchVto ?? ''),
      arcaPayload: rawCreateResult,
      recovered: false,
      timings,
    });
    logArcaProxy('durable_invoice_persisted', {
      emisionId: body.emision_id,
      contribuyenteId,
      cbteNro: authorizedNumber,
      recovered: false,
    });
    return successEmissionResponse(comprobante);
  } catch (err: any) {
    const rawMessage = String(err?.message || '');
    const detail = mapArcaServerErrorMessage(rawMessage);
    return buildErrorResponse(
      `Error del servidor: ${detail}`,
      { debug: { detalle: rawMessage } },
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
async function handlePrecalentarUltimoComprobante(
  req: Request,
  body: any,
  timings?: RequestTimings,
): Promise<Response> {
  try {
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
    const { arca, persistTicket, supabase, contribuyenteId, cachedLastNumber } =
      await getUserArcaInvoiceContext({
        req,
        puntoVenta: punto_venta,
        tipoComprobante: normalizedTipoComprobante,
        cbteTipo,
        timings,
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
      timings,
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

const AUDITABLE_INVOICE_TYPES = new Set(['FACTURA A', 'FACTURA B', 'FACTURA C']);

function formatArcaDate(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return getTodayInArgentina();
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function getConceptDescription(concepto?: number): string {
  return concepto === 1 ? 'Productos' : concepto === 3 ? 'Productos y servicios' : 'Servicios';
}

async function persistReconciledVoucher(params: {
  supabase: any;
  puntoVenta: number;
  tipoComprobante: string;
  cbteTipo: number;
  cbteNro: number;
  raw: any;
  voucher: any;
}) {
  const { data, error } = await params.supabase.rpc('reconcile_arca_voucher', {
      p_punto_venta: params.puntoVenta,
      p_tipo_comprobante: params.tipoComprobante,
      p_cbte_tipo: params.cbteTipo,
      p_cbte_nro: params.cbteNro,
      p_fecha: formatArcaDate(params.voucher.cbteFch),
      p_total: Number(params.voucher.impTotal ?? 0),
      p_cae: String(params.voucher.codAutorizacion ?? ''),
      p_vencimiento_cae: String(params.voucher.fchVto ?? ''),
      p_concepto: getConceptDescription(params.voucher.concepto),
      p_doc_tipo: Number(params.voucher.docTipo ?? 99),
      p_doc_nro: Number(params.voucher.docNro ?? 0),
      p_arca_payload: params.raw,
    });
  if (error) throw new Error(error.message);
  return data;
}

async function handleReconciliarComprobante(req: Request, body: any): Promise<Response> {
  try {
    const puntoVenta = Number(body.punto_venta);
    const tipoComprobante = String(body.tipo_comprobante ?? '').toUpperCase();
    const cbteNro = Number(body.cbte_nro);
    if (!Number.isInteger(puntoVenta) || puntoVenta <= 0 || !Number.isInteger(cbteNro) || cbteNro <= 0) {
      return buildErrorResponse('Validacion fallida: punto de venta y numero deben ser enteros positivos');
    }
    if (!AUDITABLE_INVOICE_TYPES.has(tipoComprobante)) {
      return buildErrorResponse('La reconciliacion admite solamente facturas A, B y C');
    }

    const cbteTipo = getCbteTipo(tipoComprobante);
    const { arca, supabase } = await getUserArcaInstance(req);
    const info = await queryVoucherInfo(arca, cbteNro, puntoVenta, cbteTipo);
    if (!info.voucher) {
      return new Response(JSON.stringify({ success: true, data: { status: 'not_found' } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const comprobante = await persistReconciledVoucher({
      supabase,
      puntoVenta,
      tipoComprobante,
      cbteTipo,
      cbteNro,
      raw: info.raw,
      voucher: info.voucher,
    });
    return new Response(JSON.stringify({ success: true, data: { status: 'reconciled', comprobante } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return buildErrorResponse(error instanceof Error ? error.message : String(error), {}, 500);
  }
}

async function handleAuditarComprobantes(req: Request, body: any): Promise<Response> {
  try {
    const puntoVenta = Number(body.punto_venta);
    const tipoComprobante = String(body.tipo_comprobante ?? '').toUpperCase();
    if (!Number.isInteger(puntoVenta) || puntoVenta <= 0) {
      return buildErrorResponse('Validacion fallida: punto_venta debe ser un entero positivo');
    }
    if (!AUDITABLE_INVOICE_TYPES.has(tipoComprobante)) {
      return buildErrorResponse('La auditoria admite solamente facturas A, B y C');
    }

    const cbteTipo = getCbteTipo(tipoComprobante);
    const context = await getUserArcaInstance(req);
    const last = parseLastVoucherNumber(
      await context.arca.electronicBillingService.getLastVoucher(puntoVenta, cbteTipo),
    );
    const first = Math.max(1, last - 99);
    const environment = context.arcaEnvironment;
    const { data: localRows, error: localError } = await context.supabase
      .from('comprobantes')
      .select('id, cbte_nro, cae, total, fecha')
      .eq('contribuyente_id', context.contribuyenteId)
      .eq('arca_environment', environment)
      .eq('punto_venta', puntoVenta)
      .eq('cbte_tipo', cbteTipo)
      .gte('cbte_nro', first)
      .lte('cbte_nro', last);
    if (localError) throw new Error(localError.message);

    const localByNumber = new Map((localRows ?? []).map((row: any) => [Number(row.cbte_nro), row]));
    const candidates = Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index)
      .filter((number) => {
        const row: any = localByNumber.get(number);
        return !row || !row.cae || row.total == null || !row.fecha;
      });
    const results: any[] = [];
    for (let offset = 0; offset < candidates.length; offset += 4) {
      const batch = candidates.slice(offset, offset + 4);
      const batchResults = await Promise.all(
        batch.map(async (cbteNro) => {
          try {
            const info = await queryVoucherInfo(context.arca, cbteNro, puntoVenta, cbteTipo);
            if (!info.voucher) return { cbte_nro: cbteNro, status: 'not_found' };
            const comprobante = await persistReconciledVoucher({
              supabase: context.supabase,
              puntoVenta,
              tipoComprobante,
              cbteTipo,
              cbteNro,
              raw: info.raw,
              voucher: info.voucher,
            });
            return {
              cbte_nro: cbteNro,
              status: localByNumber.has(cbteNro) ? 'repaired' : 'imported',
              comprobante,
            };
          } catch (error) {
            return { cbte_nro: cbteNro, status: 'error', error: error instanceof Error ? error.message : String(error) };
          }
        }),
      );
      results.push(...batchResults);
    }

    const summary = results.reduce(
      (acc, result) => ({ ...acc, [result.status]: (acc[result.status] ?? 0) + 1 }),
      { existing: (localRows ?? []).length - candidates.filter((n) => localByNumber.has(n)).length },
    );
    logArcaProxy('voucher_audit_completed', {
      puntoVenta,
      tipoComprobante,
      first,
      last,
      summary,
    });
    return new Response(JSON.stringify({ success: true, data: { first, last, summary, results } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return buildErrorResponse(error instanceof Error ? error.message : String(error), {}, 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const timings = new RequestTimings();
  let action: string | null = null;

  try {
    const url = new URL(req.url);
    action = url.searchParams.get('action');

    if (req.method !== 'POST') {
      return finalizeTimedResponse(
        new Response(JSON.stringify({ success: false, error: 'POST required' }), {
          status: 405,
          headers: corsHeaders,
        }),
        timings,
        action,
      );
    }

    const body = await timings.measure('body_parse', () => req.json());
    let response: Response;

    switch (action) {
      case 'crear-factura':
        response = await handleCrearFactura(req, body, timings);
        break;
      case 'crear-nota-credito':
        response = await handleCrearNotaCredito(req, body);
        break;
      case 'ultimo-comprobante':
        response = await handleUltimoComprobante(req, body);
        break;
      case 'precalentar-ultimo-comprobante':
        response = await handlePrecalentarUltimoComprobante(req, body, timings);
        break;
      case 'reconciliar-comprobante':
        response = await handleReconciliarComprobante(req, body);
        break;
      case 'auditar-comprobantes':
        response = await handleAuditarComprobantes(req, body);
        break;
      default:
        response = new Response(JSON.stringify({ success: false, error: 'Accion invalida' }), {
          status: 400,
          headers: corsHeaders,
        });
        break;
    }

    return finalizeTimedResponse(response, timings, action);
  } catch (error: any) {
    return finalizeTimedResponse(
      new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
      timings,
      action,
    );
  }
});
