import { Injectable, inject } from '@angular/core';
import { getRuntimeConfig } from '../config/runtime-config';
import { supabase, getSupabaseClient } from './supabase.service';
import { ContribuyenteService } from './contribuyente.service';
import { getFriendlyNetworkErrorMessage } from '../utils/network-error.util';
import type {
  MpSearchResult,
  MpBatchPayload,
  MpProcessBatchResponse,
  MpBatchJob,
} from '../types/mercadopago.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class MercadopagoService {
  private readonly contribuyenteService = inject(ContribuyenteService);

  /** Check if the user has an MP access token configured. */
  hasMpToken(): boolean {
    return !!this.contribuyenteService.contribuyente()?.mp_access_token;
  }

  /** Search approved MP payments for a date range, excluding already-processed ones. */
  async searchPayments(beginDate: string, endDate: string): Promise<MpSearchResult> {
    try {
      const accessToken = await this.getFreshAccessToken();
      const params = new URLSearchParams({
        begin_date: beginDate,
        end_date: endDate,
      });

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/mercadopago-sync?action=search&${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: getRuntimeConfig().supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data: MpSearchResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al buscar pagos de Mercado Pago');
      }

      return data;
    } catch (error) {
      throw new Error(
        getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error al buscar pagos de Mercado Pago',
        ),
      );
    }
  }

  /** Submit a batch for processing (facturar + ignorar). Returns the batch job ID. */
  async processBatch(payload: MpBatchPayload): Promise<string> {
    try {
      const accessToken = await this.getFreshAccessToken();

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/mercadopago-sync?action=process-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: getRuntimeConfig().supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data: MpProcessBatchResponse = await response.json();

      if (!response.ok || !data.success || !data.data?.batch_job_id) {
        throw new Error(data.error || 'Error al procesar el lote');
      }

      return data.data.batch_job_id;
    } catch (error) {
      throw new Error(
        getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error al procesar el lote',
        ),
      );
    }
  }

  /**
   * Subscribe to real-time updates on a batch job.
   * Returns the RealtimeChannel so the caller can unsubscribe.
   */
  subscribeToBatchJob(jobId: string, callback: (job: MpBatchJob) => void): RealtimeChannel {
    const channel = getSupabaseClient()
      .channel(`mp-batch-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mp_batch_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          callback(payload.new as MpBatchJob);
        },
      )
      .subscribe();

    return channel;
  }

  /** Unsubscribe from a Realtime channel. */
  unsubscribe(channel: RealtimeChannel): void {
    getSupabaseClient().removeChannel(channel);
  }

  /**
   * Get the default begin_date for the search.
   * = last processed MP date - 2 days, or 30 days ago if none.
   */
  async getDefaultBeginDate(): Promise<string> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      return this.daysAgo(30);
    }

    const { data, error } = await supabase
      .from('mp_conciliaciones')
      .select('mp_date_created')
      .eq('contribuyente_id', contribuyente.id)
      .order('mp_date_created', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.mp_date_created) {
      return this.daysAgo(30);
    }

    const lastDate = new Date(data.mp_date_created);
    lastDate.setDate(lastDate.getDate() - 2);
    return this.formatDatetimeLocalAR(lastDate);
  }

  /** Get today at 23:59:59 in Argentina timezone as datetime-local string. */
  getDefaultEndDate(): string {
    const now = new Date();
    now.setHours(23, 59, 59, 0);
    return this.formatDatetimeLocalAR(now);
  }

  /** Format a datetime-local value to ISO 8601 with Argentina offset (-03:00). */
  formatToISOWithOffset(datetimeLocal: string): string {
    return `${datetimeLocal}:00.000-03:00`;
  }

  private formatDatetimeLocalAR(date: Date): string {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  }

  private daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return this.formatDatetimeLocalAR(date);
  }

  private async getFreshAccessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No hay sesion activa');
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
    const shouldRefresh = expiresAtMs !== null && expiresAtMs - Date.now() < 60_000;

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        throw new Error('No se pudo refrescar la sesion');
      }
      const refreshedToken = data.session?.access_token;
      if (refreshedToken) {
        return refreshedToken;
      }
    }

    if (!session.access_token) {
      throw new Error('No se pudo obtener un token de sesion valido');
    }

    return session.access_token;
  }

  private get supabaseUrl(): string {
    return getRuntimeConfig().supabase.url;
  }
}
