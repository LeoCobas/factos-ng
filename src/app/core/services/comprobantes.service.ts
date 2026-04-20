import { Injectable } from '@angular/core';

import { supabase } from './supabase.service';
import { Comprobante } from '../types/database.types';
import {
  ComprobanteListadoItem,
  ComprobanteMetricRow,
} from '../types/comprobantes.types';

interface ComprobanteListadoRow extends Comprobante {
  comprobante_asociado?: {
    numero_comprobante: string;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class ComprobantesService {
  async cargarComprobantesPorFecha(
    contribuyenteId: string | null | undefined,
    fecha: string,
  ): Promise<ComprobanteListadoItem[]> {
    if (!contribuyenteId) {
      return [];
    }

    const { data: comprobantes, error } = await supabase
      .from('comprobantes')
      .select(`
        *,
        comprobante_asociado:comprobante_asociado_id (
          numero_comprobante
        )
      `)
      .eq('contribuyente_id', contribuyenteId)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar los comprobantes');
    }

    const comprobantesRows = (comprobantes || []) as ComprobanteListadoRow[];
    const notasCreditoPorAsociado = await this.cargarNotasCreditoAsociadas(
      contribuyenteId,
      comprobantesRows,
    );

    return comprobantesRows.map((comprobante) =>
      this.mapListadoItem(comprobante, notasCreditoPorAsociado),
    );
  }

  async cargarUltimaFechaConComprobantes(
    contribuyenteId: string | null | undefined,
  ): Promise<string | null> {
    if (!contribuyenteId) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('comprobantes')
        .select('fecha')
        .eq('contribuyente_id', contribuyenteId)
        .order('fecha', { ascending: false })
        .limit(1);

      if (error) {
        return null;
      }

      return data?.[0]?.fecha ?? null;
    } catch {
      return null;
    }
  }

  async cargarMetricasComprobantes(
    contribuyenteId: string | null | undefined,
  ): Promise<ComprobanteMetricRow[]> {
    if (!contribuyenteId) {
      return [];
    }

    const { data, error } = await supabase
      .from('comprobantes')
      .select('fecha, total, estado, tipo_comprobante')
      .eq('contribuyente_id', contribuyenteId)
      .order('fecha', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar las métricas de comprobantes');
    }

    return ((data || []) as Pick<
      Comprobante,
      'fecha' | 'total' | 'estado' | 'tipo_comprobante'
    >[]).map((comprobante) => ({
      fecha: comprobante.fecha,
      total: Number(comprobante.total),
      estado: comprobante.estado || 'emitida',
      tipo_comprobante: comprobante.tipo_comprobante,
      esNotaCredito: comprobante.tipo_comprobante.includes('NOTA DE CREDITO'),
    }));
  }

  private async cargarNotasCreditoAsociadas(
    contribuyenteId: string,
    comprobantes: ComprobanteListadoRow[],
  ): Promise<Map<string, string>> {
    const idsFacturasAnuladas = comprobantes
      .filter(
        (comprobante) =>
          comprobante.estado === 'anulada' &&
          !String(comprobante.tipo_comprobante).includes('NOTA DE CREDITO'),
      )
      .map((comprobante) => comprobante.id);

    const mapaNotasCreditoPorAsociado = new Map<string, string>();

    if (idsFacturasAnuladas.length === 0) {
      return mapaNotasCreditoPorAsociado;
    }

    const { data: notasCreditoAsociadas, error } = await supabase
      .from('comprobantes')
      .select('comprobante_asociado_id, numero_comprobante, created_at')
      .eq('contribuyente_id', contribuyenteId)
      .in('comprobante_asociado_id', idsFacturasAnuladas)
      .like('tipo_comprobante', 'NOTA DE CREDITO%')
      .order('created_at', { ascending: false });

    if (error) {
      return mapaNotasCreditoPorAsociado;
    }

    for (const notaCredito of (notasCreditoAsociadas || []) as Pick<
      Comprobante,
      'comprobante_asociado_id' | 'numero_comprobante'
    >[]) {
      if (!notaCredito.comprobante_asociado_id || !notaCredito.numero_comprobante) {
        continue;
      }

      if (!mapaNotasCreditoPorAsociado.has(notaCredito.comprobante_asociado_id)) {
        mapaNotasCreditoPorAsociado.set(
          notaCredito.comprobante_asociado_id,
          notaCredito.numero_comprobante,
        );
      }
    }

    return mapaNotasCreditoPorAsociado;
  }

  private mapListadoItem(
    comprobante: ComprobanteListadoRow,
    notasCreditoPorAsociado: Map<string, string>,
  ): ComprobanteListadoItem {
    const esNotaCredito = comprobante.tipo_comprobante.includes('NOTA DE CREDITO');

    return {
      id: comprobante.id,
      numero_factura: comprobante.numero_comprobante,
      fecha: comprobante.fecha,
      monto: Number(comprobante.total),
      estado: (comprobante.estado as 'emitida' | 'anulada') || 'emitida',
      cae: comprobante.cae || undefined,
      vencimiento_cae: comprobante.vencimiento_cae || undefined,
      tipo_comprobante: comprobante.tipo_comprobante,
      pdf_url: comprobante.pdf_url || undefined,
      concepto: comprobante.concepto || undefined,
      punto_venta: comprobante.punto_venta || undefined,
      cliente_cuit: comprobante.cliente_cuit || undefined,
      cliente_nombre: comprobante.cliente_nombre || undefined,
      cliente_domicilio: comprobante.cliente_domicilio || undefined,
      cliente_condicion_iva: comprobante.cliente_condicion_iva || undefined,
      cliente_doc_tipo: comprobante.cliente_doc_tipo || undefined,
      cliente_doc_nro: comprobante.cliente_doc_nro || undefined,
      created_at: comprobante.created_at || undefined,
      updated_at: comprobante.updated_at || undefined,
      comprobante_asociado_id: comprobante.comprobante_asociado_id || undefined,
      factura_anulada: esNotaCredito
        ? comprobante.comprobante_asociado?.numero_comprobante || undefined
        : undefined,
      nota_credito_anuladora: !esNotaCredito
        ? notasCreditoPorAsociado.get(comprobante.id)
        : undefined,
    };
  }
}
