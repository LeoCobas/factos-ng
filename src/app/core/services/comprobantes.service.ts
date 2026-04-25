import { Injectable } from '@angular/core';

import { supabase } from './supabase.service';
import { Comprobante } from '../types/database.types';
import {
  ComprobanteListadoItem,
  ComprobantesListadoOptions,
  ComprobantesListadoResult,
  ComprobanteMetricRow,
  ResumenComprobantesPorFecha,
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
  async cargarComprobantesListado(
    contribuyenteId: string | null | undefined,
    options: ComprobantesListadoOptions,
  ): Promise<ComprobantesListadoResult> {
    if (!contribuyenteId) {
      return { items: [], hasMore: false };
    }

    let query = supabase
      .from('comprobantes')
      .select(
        `
        *,
        comprobante_asociado:comprobante_asociado_id (
          numero_comprobante
        )
      `,
      )
      .eq('contribuyente_id', contribuyenteId);

    if (options.fecha) {
      query = query.eq('fecha', options.fecha);
    }

    const { data: comprobantes, error } = await query
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit);

    if (error) {
      throw new Error('No se pudieron cargar los comprobantes');
    }

    const comprobantesRows = (comprobantes || []) as ComprobanteListadoRow[];
    const itemsRows = comprobantesRows.slice(0, options.limit);
    const notasCreditoPorAsociado = await this.cargarNotasCreditoAsociadas(
      contribuyenteId,
      itemsRows,
    );

    return {
      items: itemsRows.map((comprobante) =>
        this.mapListadoItem(comprobante, notasCreditoPorAsociado),
      ),
      hasMore: comprobantesRows.length > options.limit,
    };
  }

  async cargarResumenComprobantesPorFecha(
    contribuyenteId: string | null | undefined,
    fecha: string,
  ): Promise<ResumenComprobantesPorFecha> {
    if (!contribuyenteId) {
      return { cantidad: 0, total: 0 };
    }

    const { data, error } = await supabase
      .from('comprobantes')
      .select('total, estado, tipo_comprobante')
      .eq('contribuyente_id', contribuyenteId)
      .eq('fecha', fecha);

    if (error) {
      throw new Error('No se pudo cargar el resumen de comprobantes');
    }

    const comprobantes = (data || []) as Pick<
      Comprobante,
      'total' | 'estado' | 'tipo_comprobante'
    >[];

    return {
      cantidad: comprobantes.length,
      total: comprobantes
        .filter((comprobante) => comprobante.estado === 'emitida')
        .reduce((total, comprobante) => {
          const monto = Number(comprobante.total ?? 0);
          return (
            total + (comprobante.tipo_comprobante.includes('NOTA DE CREDITO') ? -monto : monto)
          );
        }, 0),
    };
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

    return (
      (data || []) as Pick<Comprobante, 'fecha' | 'total' | 'estado' | 'tipo_comprobante'>[]
    ).map((comprobante) => ({
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
