import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Arca } from 'npm:@arcasdk/core@0.3.6';
import { readArcaTicketBucket } from '../../../src/app/core/utils/arca-ticket.util.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ARCA_TICKET_PATH = '/tmp/factos-arca-tickets';
const WSFE_SERVICE_NAME = 'wsfe';
const LAST_VOUCHER_CACHE_TTL_MS = 15 * 60 * 1000;

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
  cuit: number;
  production: boolean;
  originalTicket?: any;
}): Promise<void> {
  try {
    const filePath = getTicketFilePath(params.cuit, WSFE_SERVICE_NAME, params.production);
    const fileData = await Deno.readTextFile(filePath);
    const ticket = JSON.parse(fileData);

    if (!isStoredTicketValid(ticket)) return;

    if (params.originalTicket && JSON.stringify(params.originalTicket) === JSON.stringify(ticket)) {
      return;
    }

    const { error } = await params.supabase.rpc('merge_arca_ticket_bucket', {
      p_bucket: 'wsfe',
      p_ticket: ticket,
    });

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

function parseLastVoucherNumber(lastVoucher: any): number {
  const lastNumber =
    typeof lastVoucher === 'number'
      ? lastVoucher
      : lastVoucher?.cbteNro || lastVoucher?.CbteNro || 0;

  return Number.isFinite(Number(lastNumber)) ? Number(lastNumber) : 0;
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

function normalizeErrorText(message: string): string {
  return message
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
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
    .gte('synced_at', new Date(Date.now() - LAST_VOUCHER_CACHE_TTL_MS).toISOString())
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
  const lastVoucher = await params.arca.electronicBillingService.getLastVoucher(
    params.puntoVenta,
    params.cbteTipo,
  );
  await params.persistTicket();
  const ultimoComprobante = parseLastVoucherNumber(lastVoucher);

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

function formatNumeroComprobante(ptoVta: number, cbteNro: number): string {
  return `${String(ptoVta).padStart(4, '0')}-${String(cbteNro).padStart(8, '0')}`;
}

function clampDate(paymentDateStr: string, actividad: string, lastEmittedDateStr?: string): string {
  // Get current date string in Buenos Aires
  const arTodayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Parse dates as UTC "YYYY-MM-DDT12:00:00Z" to act as Argentina time safely
  const paymentDateOnly = paymentDateStr.split('T')[0];
  const paymentDateUTC = new Date(`${paymentDateOnly}T12:00:00Z`);
  const todayUTC = new Date(`${arTodayStr}T12:00:00Z`);

  const maxDaysBack = actividad === 'servicios' ? 10 : 5;
  const earliestAllowedUTC = new Date(todayUTC.getTime());
  earliestAllowedUTC.setUTCDate(todayUTC.getUTCDate() - maxDaysBack);
  earliestAllowedUTC.setUTCHours(0, 0, 0, 0); // 00:00:00 UTC (representing Buenos Aires 00:00:00)

  let effectiveDateUTC = paymentDateUTC;
  if (effectiveDateUTC < earliestAllowedUTC) {
    effectiveDateUTC = earliestAllowedUTC;
  }

  if (lastEmittedDateStr) {
    const lastEmittedDateOnly = lastEmittedDateStr.split('T')[0];
    const lastEmittedDateUTC = new Date(`${lastEmittedDateOnly}T12:00:00Z`);
    if (effectiveDateUTC < lastEmittedDateUTC) {
      effectiveDateUTC = lastEmittedDateUTC;
    }
  }

  const todayMaxUTC = new Date(`${arTodayStr}T23:59:59Z`);
  if (effectiveDateUTC > todayMaxUTC) {
    effectiveDateUTC = todayMaxUTC;
  }

  // Format from UTC directly
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(effectiveDateUTC);
}


function getLocalDateStr(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return typeof dateStr === 'string'
      ? dateStr.split('T')[0]
      : new Date().toISOString().split('T')[0];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const { supabase: supabaseUser, user } = await getAuthenticatedUser(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(supabaseUrl, serviceKey);

    const { data: contribuyente, error: contribErr } = await db
      .from('contribuyentes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (contribErr) {
      return new Response(JSON.stringify({ success: false, error: 'Error al consultar contribuyente' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contribuyente) {
      return new Response(JSON.stringify({ success: false, error: 'No se encontró el contribuyente' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Search
    if (action === 'search') {
      if (!contribuyente.mp_access_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mercado Pago no está configurado. Carga tu token en Configuración.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const beginDate = url.searchParams.get('begin_date');
      const endDate = url.searchParams.get('end_date');

      if (!beginDate || !endDate) {
        return new Response(JSON.stringify({ success: false, error: 'Rango de fechas requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch Mercado Pago user profile to get their user ID (collector ID)
      const meRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          Authorization: `Bearer ${contribuyente.mp_access_token}`,
        },
      });
      if (!meRes.ok) {
        throw new Error('No se pudo obtener el perfil de Mercado Pago');
      }
      const meData = await meRes.json();
      const mpUserId = meData.id;

      let payments: any[] = [];
      let offset = 0;
      let hasMore = true;
      const limit = 100;

      while (hasMore && payments.length < 300) {
        const mpSearchUrl = `https://api.mercadopago.com/v1/payments/search?status=approved&collector.id=${mpUserId}&range=date_created&begin_date=${encodeURIComponent(beginDate)}&end_date=${encodeURIComponent(endDate)}&sort=date_created&criteria=asc&limit=${limit}&offset=${offset}`;

        const res = await fetch(mpSearchUrl, {
          headers: {
            Authorization: `Bearer ${contribuyente.mp_access_token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ message: 'Error desconocido' }));
          throw new Error(errData.message || 'Error en la API de Mercado Pago');
        }

        const json = await res.json();
        const results = json.results || [];
        payments = payments.concat(results);

        if (results.length < limit || payments.length >= (json.paging?.total || 0)) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      if (payments.length === 0) {
        return new Response(JSON.stringify({ success: true, data: { payments: [], total: 0, filtered_out: 0 } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mpPaymentIds = payments.map((p) => String(p.id));

      const { data: existing, error: existErr } = await db
        .from('mp_conciliaciones')
        .select('mp_payment_id')
        .eq('contribuyente_id', contribuyente.id)
        .in('mp_payment_id', mpPaymentIds);

      if (existErr) {
        throw new Error(`Error al consultar conciliaciones: ${existErr.message}`);
      }

      const existingSet = new Set((existing || []).map((e: any) => e.mp_payment_id));

      const filteredPayments = payments
        .filter((p) => {
          if (existingSet.has(String(p.id))) return false;
          
          // Safeguard: only keep payments where the collector is the user (excludes purchases/expenses)
          if (p.collector_id !== mpUserId) return false;
          
          // Exclude ANSES / CUNA
          const desc = (p.description || '').toLowerCase();
          if (desc.includes('cuna') || desc.includes('anses')) return false;
          
          return true;
        })
        .map((p) => ({
          id: String(p.id),
          date_created: p.date_created,
          transaction_amount: p.transaction_amount,
          description: p.description || null,
          payer: {
            first_name: p.payer?.first_name || null,
            last_name: p.payer?.last_name || null,
          },
        }));

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            payments: filteredPayments,
            total: payments.length,
            filtered_out: payments.length - filteredPayments.length,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Process Batch
    if (action === 'process-batch') {
      const { facturar, ignorar, payments_data, combinar_por_dia } = await req.json();

      if (!Array.isArray(facturar) || !Array.isArray(ignorar)) {
        return new Response(JSON.stringify({ success: false, error: 'Datos de lote inválidos' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const totalItems = facturar.length + ignorar.length;

      // Create the batch job row
      const { data: job, error: jobErr } = await db
        .from('mp_batch_jobs')
        .insert({
          contribuyente_id: contribuyente.id,
          status: 'processing',
          total_items: totalItems,
          processed_items: 0,
          successful_items: 0,
          failed_items: 0,
          ignored_items: 0,
          results: [],
        })
        .select()
        .single();

      if (jobErr) {
        return new Response(JSON.stringify({ success: false, error: 'No se pudo crear el lote de procesamiento' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Process in background asynchronously using ctx/EdgeRuntime.waitUntil
      const promise = (async () => {
        let processedItems = 0;
        let successfulItems = 0;
        let failedItems = 0;
        let ignoredItems = 0;
        const results: any[] = [];

        try {
          // 1. Process ignorar list
          if (ignorar.length > 0) {
            const ignorarRows = ignorar.map((id: string) => {
              const pData = payments_data[id];
              return {
                contribuyente_id: contribuyente.id,
                mp_payment_id: id,
                status: 'ignorado',
                mp_date_created: pData?.date_created || new Date().toISOString(),
                mp_transaction_amount: pData?.transaction_amount || 0,
                mp_description: pData?.description || null,
                mp_payer_name: pData?.payer_name || null,
                batch_job_id: job.id,
              };
            });

            const { error: ignErr } = await db.from('mp_conciliaciones').upsert(ignorarRows, {
              onConflict: 'contribuyente_id,mp_payment_id',
            });

            if (ignErr) {
              console.error('Error insertando ignorados:', ignErr.message);
            }

            processedItems += ignorar.length;
            ignoredItems += ignorar.length;

            ignorar.forEach((id: string) => {
              results.push({
                mp_payment_id: id,
                status: 'ignorado',
              });
            });

            await db
              .from('mp_batch_jobs')
              .update({
                processed_items: processedItems,
                ignored_items: ignoredItems,
                results,
              })
              .eq('id', job.id);
          }

          // 2. Process facturar list
          if (facturar.length > 0) {
            if (!contribuyente.arca_cert || !contribuyente.arca_key) {
              throw new Error('Certificados ARCA no configurados en el perfil');
            }

            const cuitEmisor = parseInt(contribuyente.cuit, 10);
            const production = contribuyente.arca_production === true;
            const credentials = getValidStoredTicket(contribuyente.arca_ticket, 'wsfe');
            const arca = new Arca({
              cert: contribuyente.arca_cert,
              key: contribuyente.arca_key,
              cuit: cuitEmisor,
              production,
              credentials: credentials || undefined,
              handleTicket: true,
              useHttpsAgent: false,
              ticketPath: ARCA_TICKET_PATH,
            });

            const persistTicket = () =>
              persistTicketFromFile({
                supabase: db,
                cuit: cuitEmisor,
                production,
                originalTicket: credentials || undefined,
              });

            const tipoComprobante =
              contribuyente.condicion_iva === 'Monotributo' ? 'FACTURA C' : 'FACTURA B';
            const cbteTipo = getCbteTipo(tipoComprobante);
            const isFacturaC = tipoComprobante === 'FACTURA C';
            const ivaPct = Number(contribuyente.iva_porcentaje) || 21;

            // Maximum amount allowed per invoice (AFIP limit)
            const rawMax = parseFloat(contribuyente.monto_maximo_factura || '99999999');
            const maxInvoiceAmount = rawMax > 0 ? rawMax : 99999999;

            // Sort payments by date ASC
            const facturarSorted = [...facturar].sort((a, b) => {
              const dateA = new Date(payments_data[a]?.date_created || 0).getTime();
              const dateB = new Date(payments_data[b]?.date_created || 0).getTime();
              return dateA - dateB;
            });

            // Struct for invoicing batches
            interface InvoicingBatch {
              dateStr: string;
              paymentIds: string[];
              amount: number;
            }

            const batches: InvoicingBatch[] = [];

            if (combinar_por_dia) {
              // Group payments by date
              const groups: Record<string, string[]> = {};
              for (const pid of facturarSorted) {
                const pData = payments_data[pid];
                if (!pData) continue;
                const dateStr = getLocalDateStr(pData.date_created);
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(pid);
              }

              // Build batches sequentially, respecting maxInvoiceAmount
              for (const [dateStr, pids] of Object.entries(groups)) {
                let currentBatchPids: string[] = [];
                let currentBatchAmount = 0;

                for (const pid of pids) {
                  const pData = payments_data[pid];
                  const amount = parseFloat(String(pData.transaction_amount));

                  if (amount > maxInvoiceAmount) {
                    // Finalize current active batch if it has items
                    if (currentBatchPids.length > 0) {
                      batches.push({ dateStr, paymentIds: currentBatchPids, amount: currentBatchAmount });
                      currentBatchPids = [];
                      currentBatchAmount = 0;
                    }
                    // This single payment exceeds limit, must be isolated and will be split in invoices later
                    batches.push({ dateStr, paymentIds: [pid], amount });
                  } else if (currentBatchAmount + amount > maxInvoiceAmount) {
                    // Finalize current active batch
                    batches.push({ dateStr, paymentIds: currentBatchPids, amount: currentBatchAmount });
                    // Start new batch with current payment
                    currentBatchPids = [pid];
                    currentBatchAmount = amount;
                  } else {
                    currentBatchPids.push(pid);
                    currentBatchAmount += amount;
                  }
                }

                if (currentBatchPids.length > 0) {
                  batches.push({ dateStr, paymentIds: currentBatchPids, amount: currentBatchAmount });
                }
              }
            } else {
              // Not combined: each payment is its own batch
              for (const pid of facturarSorted) {
                const pData = payments_data[pid];
                if (!pData) continue;
                batches.push({
                  dateStr: getLocalDateStr(pData.date_created),
                  paymentIds: [pid],
                  amount: parseFloat(String(pData.transaction_amount)),
                });
              }
            }

            // Emit invoices sequentially for each batch
            for (const batch of batches) {
              let itemSuccess = false;
              let itemErrorMsg = '';
              const generatedComprobanteIds: string[] = [];
              let lastCbteNroFormatted = '';
              let firstCbteNroFormatted = '';

              try {
                // Determine invoice date clamped to AFIP rules
                const { data: lastComprobante } = await db
                  .from('comprobantes')
                  .select('fecha')
                  .eq('contribuyente_id', contribuyente.id)
                  .eq('tipo_comprobante', tipoComprobante)
                  .order('fecha', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                const lastEmittedDateStr = lastComprobante?.fecha || undefined;
                
                // Use the batch dateStr, clamp to AFIP window
                const invoiceDateStr = clampDate(
                  batch.dateStr + 'T12:00:00',
                  contribuyente.actividad || 'bienes',
                  lastEmittedDateStr
                );

                // Sub-invoices calculation (if batch.amount > maxInvoiceAmount, e.g. for a huge single payment)
                const invoiceAmounts: number[] = [];
                let remainingAmount = batch.amount;
                while (remainingAmount > 0) {
                  const amt = Math.min(remainingAmount, maxInvoiceAmount);
                  invoiceAmounts.push(parseFloat(amt.toFixed(2)));
                  remainingAmount -= amt;
                }

                // Get last voucher number cache
                let cachedLastNumber = await getCachedLastVoucher({
                  supabase: db,
                  contribuyenteId: contribuyente.id,
                  puntoVenta: contribuyente.punto_venta,
                  tipoComprobante,
                  cbteTipo,
                });

                if (cachedLastNumber === null) {
                  cachedLastNumber = await fetchAndCacheLastVoucher({
                    arca,
                    persistTicket,
                    supabase: db,
                    contribuyenteId: contribuyente.id,
                    puntoVenta: contribuyente.punto_venta,
                    tipoComprobante,
                    cbteTipo,
                  });
                }

                let nextCbteNro = cachedLastNumber + 1;

                for (const montoTotal of invoiceAmounts) {
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

                  const fechaNum = parseInt(invoiceDateStr.replace(/-/g, ''), 10);
                  const conceptoNum = contribuyente.concepto === 'servicios' ? 2 : 1;

                  const voucherPayload: any = {
                    CantReg: 1,
                    PtoVta: contribuyente.punto_venta,
                    CbteTipo: cbteTipo,
                    Concepto: conceptoNum,
                    DocTipo: 99, // Consumidor Final
                    DocNro: 0,
                    CondicionIVAReceptorId: 5, // Consumidor Final
                    CbteDesde: nextCbteNro,
                    CbteHasta: nextCbteNro,
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

                  let parsed = extractWsfeResult(
                    await arca.electronicBillingService.createVoucher(voucherPayload)
                  );
                  await persistTicket();

                  // Handle numbering rejections
                  if (parsed.resultado !== 'A') {
                    const rejected = getArcaRejectionError(parsed);
                    if (isNumberingRejection(parsed, rejected.errorMessage)) {
                      const refreshedLastNumber = await fetchAndCacheLastVoucher({
                        arca,
                        persistTicket,
                        supabase: db,
                        contribuyenteId: contribuyente.id,
                        puntoVenta: contribuyente.punto_venta,
                        tipoComprobante,
                        cbteTipo,
                      });
                      nextCbteNro = refreshedLastNumber + 1;
                      voucherPayload.CbteDesde = nextCbteNro;
                      voucherPayload.CbteHasta = nextCbteNro;

                      parsed = extractWsfeResult(
                        await arca.electronicBillingService.createVoucher(voucherPayload)
                      );
                      await persistTicket();
                    }
                  }

                  if (parsed.resultado !== 'A') {
                    const rejected = getArcaRejectionError(parsed);
                    throw new Error(rejected.errorMessage);
                  }

                  // Update last voucher cache
                  const actualCbteNro = Number(parsed.cbteDesde || nextCbteNro);
                  await upsertLastVoucherCache({
                    supabase: db,
                    contribuyenteId: contribuyente.id,
                    puntoVenta: contribuyente.punto_venta,
                    tipoComprobante,
                    cbteTipo,
                    ultimoComprobante: actualCbteNro,
                  });

                  lastCbteNroFormatted = formatNumeroComprobante(contribuyente.punto_venta, actualCbteNro);
                  if (!firstCbteNroFormatted) {
                    firstCbteNroFormatted = lastCbteNroFormatted;
                  }

                  // Create description: use contribuyente's default description
                  const invoiceDescription = contribuyente.concepto || 'Venta de servicios';

                  // Insert into comprobantes
                  const { data: comprobante, error: compErr } = await db
                    .from('comprobantes')
                    .insert({
                      contribuyente_id: contribuyente.id,
                      tipo_comprobante: tipoComprobante,
                      numero_comprobante: lastCbteNroFormatted,
                      punto_venta: contribuyente.punto_venta,
                      fecha: invoiceDateStr,
                      total: montoTotal,
                      cae: parsed.cae,
                      vencimiento_cae: parsed.caeFchVto,
                      estado: 'emitida',
                      concepto: invoiceDescription,
                      pdf_url: null,
                      cliente_cuit: null,
                      cliente_doc_tipo: 99,
                      cliente_doc_nro: 0,
                      cliente_nombre: batch.paymentIds.length === 1
                        ? (payments_data[batch.paymentIds[0]]?.payer_name || 'Consumidor Final')
                        : 'Consumidor Final',
                      cliente_domicilio: null,
                      cliente_condicion_iva: 'Consumidor Final',
                    })
                    .select()
                    .single();

                  if (compErr) {
                    throw new Error(`Error al persistir comprobante: ${compErr.message}`);
                  }

                  generatedComprobanteIds.push(comprobante.id);
                  nextCbteNro = actualCbteNro + 1;
                }

                itemSuccess = true;
              } catch (itemErr: any) {
                itemErrorMsg = itemErr.message || 'Error desconocido al emitir comprobante';
              }

              // Update mp_conciliaciones rows for all payment IDs in this batch using a single upsert
              const conciliacionRows = batch.paymentIds.map((paymentId) => {
                const pData = payments_data[paymentId] || {};
                return {
                  contribuyente_id: contribuyente.id,
                  mp_payment_id: paymentId,
                  status: itemSuccess ? 'facturado' : 'fallido',
                  mp_date_created: pData.date_created || new Date().toISOString(),
                  mp_transaction_amount: pData.transaction_amount || 0,
                  mp_description: pData.description || null,
                  mp_payer_name: pData.payer_name || 'Consumidor Final',
                  comprobante_id: itemSuccess ? generatedComprobanteIds[0] : null,
                  error_message: itemSuccess ? null : itemErrorMsg,
                  batch_job_id: job.id,
                };
              });

              const { error: concErr } = await db.from('mp_conciliaciones').upsert(conciliacionRows, {
                onConflict: 'contribuyente_id,mp_payment_id',
              });

              if (concErr) {
                console.error('Error insertando conciliaciones en lote:', concErr.message);
              }

              for (const paymentId of batch.paymentIds) {
                results.push({
                  mp_payment_id: paymentId,
                  status: itemSuccess ? 'facturado' : 'fallido',
                  error: itemSuccess ? undefined : itemErrorMsg,
                  comprobante_numero: itemSuccess ? firstCbteNroFormatted : undefined,
                });
              }

              processedItems += batch.paymentIds.length;
              if (itemSuccess) {
                successfulItems += batch.paymentIds.length;
              } else {
                failedItems += batch.paymentIds.length;
              }

              // Save progress
              await db
                .from('mp_batch_jobs')
                .update({
                  processed_items: processedItems,
                  successful_items: successfulItems,
                  failed_items: failedItems,
                  results,
                })
                .eq('id', job.id);
            }
          }

          // Complete job status
          const finalStatus = successfulItems + ignoredItems > 0 ? 'completed' : 'failed';
          await db
            .from('mp_batch_jobs')
            .update({
              status: finalStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        } catch (jobFatalErr: any) {
          console.error('Fatal error in batch processing:', jobFatalErr);
          await db
            .from('mp_batch_jobs')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        }
      })();

      // Start background task in Deno runtime
      EdgeRuntime.waitUntil(promise);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            batch_job_id: job.id,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: 'Acción no permitida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
