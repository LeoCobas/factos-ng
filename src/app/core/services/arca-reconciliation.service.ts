import { Injectable } from '@angular/core';
import { getRuntimeConfig } from '../config/runtime-config';
import { supabase } from './supabase.service';

export type AuditableInvoiceType = 'FACTURA A' | 'FACTURA B' | 'FACTURA C';

export interface ReconciliationResult {
  cbte_nro: number;
  status: 'existing' | 'imported' | 'repaired' | 'reconciled' | 'not_found' | 'conflict' | 'error';
  comprobante?: unknown;
  error?: string;
}

export interface ReconciliationAudit {
  first: number;
  last: number;
  summary: Record<string, number>;
  results: ReconciliationResult[];
}

@Injectable({ providedIn: 'root' })
export class ArcaReconciliationService {
  async auditar(puntoVenta: number, tipoComprobante: AuditableInvoiceType): Promise<ReconciliationAudit> {
    return this.call('auditar-comprobantes', {
      punto_venta: puntoVenta,
      tipo_comprobante: tipoComprobante,
    });
  }

  async reconciliar(
    puntoVenta: number,
    tipoComprobante: AuditableInvoiceType,
    cbteNro: number,
  ): Promise<{ status: ReconciliationResult['status']; comprobante?: unknown }> {
    return this.call('reconciliar-comprobante', {
      punto_venta: puntoVenta,
      tipo_comprobante: tipoComprobante,
      cbte_nro: cbteNro,
    });
  }

  private async call<T>(action: string, body: Record<string, unknown>): Promise<T> {
    const accessToken = await this.getFreshAccessToken();
    const config = getRuntimeConfig();
    const response = await fetch(`${config.supabase.url}/functions/v1/arca-proxy?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabase.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'No se pudo consultar ARCA');
    return payload.data as T;
  }

  private async getFreshAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    if (error || !session?.access_token) throw new Error('Sesion invalida');

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
    if (expiresAtMs !== null && expiresAtMs - Date.now() < 60_000) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session?.access_token) {
        throw new Error('No se pudo refrescar la sesion');
      }
      return refreshed.data.session.access_token;
    }

    return session.access_token;
  }
}
