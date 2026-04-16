import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Contribuyente } from '../types/database.types';
import { getClienteDocData, normalizeCondicionIva } from '../utils/factura-cliente.util';

// Inicializar fuentes virtuales de pdfMake
(pdfMake as any).vfs = (pdfFonts as any).vfs;

@Injectable({
  providedIn: 'root'
})
export class FacturaPdfService {
  private readonly pageWidth = 226;
  private readonly pageMargins: [number, number, number, number] = [8, 10, 8, 10];

  constructor() {}

  /**
   * Genera el PDF en memoria y devuelve un Blob.
   */
  async generarFacturaPdf(contribuyente: Contribuyente, comprobante: any): Promise<Blob> {
    const docDefinition = this.crearDefinicionDocumento(contribuyente, comprobante);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    return await pdfDocGenerator.getBlob();
  }

  /**
   * Template completo de ticket 80mm conforme a ARCA RG 1415.
   */
  private crearDefinicionDocumento(contribuyente: Contribuyente, comprobante: any): TDocumentDefinitions {
    const tipo = comprobante.tipo_comprobante || 'FACTURA C';
    const codigoTipo = this.getCbteTipoEnum(tipo);
    const esFacturaC = tipo.includes('C');
    const importe = Number(comprobante.total || comprobante.monto || 0);
    const numero = String(comprobante.numero_comprobante || comprobante.numero_factura || '0000-00000000');
    const fechaFormat = this.formatearFechaArg(comprobante.fecha || new Date().toISOString());
    const clienteNombre = comprobante.cliente_nombre || 'A CONSUMIDOR FINAL';
    const clienteDomicilio = comprobante.cliente_domicilio || '-';
    const clienteCondicionIva = normalizeCondicionIva(comprobante.cliente_condicion_iva);
    const clienteDocData = getClienteDocData({
      cuit: comprobante.cliente_cuit,
      doc_tipo: comprobante.cliente_doc_tipo,
      doc_nro: comprobante.cliente_doc_nro,
    });

    const condicionIva =
      contribuyente.condicion_iva ||
      (esFacturaC ? 'Responsable Monotributo' : 'IVA Responsable Inscripto');
    const iibb = contribuyente.ingresos_brutos || contribuyente.cuit;
    const inicioAct = contribuyente.inicio_actividades
      ? this.formatearFechaArg(contribuyente.inicio_actividades)
      : '';

    const qrData = this.generarQrData(contribuyente, comprobante);
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(qrData))}`;

    const headerContent: Content[] = [];

    headerContent.push({
      text: `ORIGINAL - ${tipo} (COD. ${codigoTipo.toString().padStart(2, '0')})`,
      alignment: 'center',
      bold: true,
      fontSize: 7,
      margin: [0, 0, 0, 4]
    });

    headerContent.push(this.crearSeparador());

    if (contribuyente.nombre_fantasia) {
      headerContent.push({
        text: contribuyente.nombre_fantasia.toUpperCase(),
        alignment: 'center',
        bold: true,
        fontSize: 11,
        margin: [0, 1, 0, 2]
      });
      headerContent.push({
        text: `Razón social: ${contribuyente.razon_social}`,
        alignment: 'center',
        fontSize: 7
      });
    } else {
      headerContent.push({
        text: contribuyente.razon_social.toUpperCase(),
        alignment: 'center',
        bold: true,
        fontSize: 10,
        margin: [0, 1, 0, 2]
      });
    }

    if (contribuyente.domicilio) {
      headerContent.push({
        text: `Domicilio: ${contribuyente.domicilio}`,
        alignment: 'center',
        fontSize: 7
      });
    }

    headerContent.push({
      text: `Cond. frente al IVA: ${condicionIva}`,
      alignment: 'center',
      fontSize: 7
    });

    headerContent.push({
      text: `CUIT: ${this.formatearCuit(contribuyente.cuit)}`,
      alignment: 'center',
      fontSize: 7
    });

    const lineaIibb = `Ingresos Brutos: ${iibb}`;
    const lineaInicio = inicioAct ? ` - Inicio act.: ${inicioAct}` : '';
    headerContent.push({
      text: lineaIibb + lineaInicio,
      alignment: 'center',
      fontSize: 6.5
    });

    headerContent.push(this.crearSeparador());

    const comprobanteContent: Content[] = [
      {
        text: `${tipo}  Nro.: ${numero}`,
        bold: true,
        fontSize: 8.5,
        margin: [0, 0, 0, 2]
      },
      {
        text: `Fecha: ${fechaFormat}`,
        fontSize: 7
      },
      this.crearSeparador()
    ];

    const receptorContent: Content[] = [
      {
        text: clienteNombre,
        bold: true,
        fontSize: 8,
        alignment: 'center',
        margin: [0, 0, 0, 2]
      },
      {
        text: `CUIT/DOC: ${comprobante.cliente_cuit || clienteDocData.docNro || '-'}`,
        fontSize: 7
      },
      {
        text: `Cond. frente al IVA: ${clienteCondicionIva}`,
        fontSize: 7
      },
      {
        text: `Domicilio: ${clienteDomicilio}`,
        fontSize: 7
      },
      {
        text: 'Cond. Venta: Contado',
        fontSize: 7
      },
      this.crearSeparador()
    ];

    const detalleContent: Content[] = [
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'Concepto', bold: true, fontSize: 7 },
              { text: 'Subtotal', bold: true, alignment: 'right' as const, fontSize: 7 }
            ],
            [
              { text: comprobante.concepto || contribuyente.concepto || 'Varios', fontSize: 7 },
              { text: `$ ${this.formatearMoneda(importe)}`, alignment: 'right' as const, fontSize: 7 }
            ]
          ]
        },
        layout: 'lightHorizontalLines'
      } as Content
    ];

    const totalContent: Content[] = [
      {
        columns: [
          { text: 'TOTAL:', bold: true, fontSize: 11 },
          {
            text: `$ ${this.formatearMoneda(importe)}`,
            bold: true,
            fontSize: 11,
            alignment: 'right'
          }
        ],
        margin: [0, 6, 0, 2]
      } as Content,
      this.crearSeparador()
    ];

    const arcaContent: Content[] = [
      { text: `CAE N°: ${comprobante.cae || 'N/D'}`, fontSize: 7, alignment: 'center' },
      {
        text: `Fecha vencimiento CAE: ${
          this.formatearFechaArg(comprobante.vencimiento_cae || comprobante.cae_vto) || 'N/D'
        }`,
        fontSize: 7,
        alignment: 'center'
      },
      {
        qr: qrUrl,
        fit: 85,
        alignment: 'center' as const,
        margin: [0, 8, 0, 4]
      } as Content,
      {
        text: 'ARCA',
        alignment: 'center',
        bold: true,
        fontSize: 10
      },
      {
        text: 'Comprobante Autorizado',
        alignment: 'center',
        bold: true,
        italics: true,
        fontSize: 7,
        margin: [0, 0, 0, 4]
      },
      {
        text: 'Esta Administración Federal no se responsabiliza por los datos ingresados en el detalle de la operación.',
        alignment: 'center',
        fontSize: 5.5,
        color: '#666666'
      }
    ];

    return {
      pageSize: { width: this.pageWidth, height: 'auto' },
      pageMargins: this.pageMargins,
      defaultStyle: {
        fontSize: 7,
        font: 'Roboto'
      },
      content: [
        ...headerContent,
        ...comprobanteContent,
        ...receptorContent,
        ...detalleContent,
        ...totalContent,
        ...arcaContent
      ]
    };
  }

  private crearSeparador(): Content {
    const usableWidth = this.pageWidth - this.pageMargins[0] - this.pageMargins[2];
    return {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: usableWidth,
          y2: 0,
          lineWidth: 0.6,
          lineColor: '#b5b5b5'
        }
      ],
      margin: [0, 6, 0, 6]
    } as Content;
  }

  private formatearCuit(cuit: string): string {
    if (!cuit || cuit.length !== 11) return cuit || '';
    return `${cuit.substring(0, 2)}-${cuit.substring(2, 10)}-${cuit.substring(10, 11)}`;
  }

  private formatearFechaArg(fechaIso: string | null | undefined): string {
    if (!fechaIso) return '';
    if (fechaIso.length === 8 && !fechaIso.includes('-')) {
      return `${fechaIso.substring(6, 8)}/${fechaIso.substring(4, 6)}/${fechaIso.substring(0, 4)}`;
    }
    const match = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return fechaIso;
  }

  private formatearMoneda(monto: number): string {
    return monto.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private getCbteTipoEnum(tipoComprobante: string): number {
    const tipos: Record<string, number> = {
      'FACTURA A': 1,
      'NOTA DE DEBITO A': 2,
      'NOTA DE CREDITO A': 3,
      'FACTURA B': 6,
      'NOTA DE DEBITO B': 7,
      'NOTA DE CREDITO B': 8,
      'FACTURA C': 11,
      'NOTA DE DEBITO C': 12,
      'NOTA DE CREDITO C': 13
    };
    return tipos[tipoComprobante.toUpperCase()] || 11;
  }

  private generarQrData(contribuyente: Contribuyente, comprobante: any): any {
    const numero = String(comprobante.numero_comprobante || comprobante.numero_factura || '0');
    const nroCmpStr = numero.split('-').pop() || '1';
    const nroCmp = parseInt(nroCmpStr, 10);
    const clienteDocData = getClienteDocData({
      cuit: comprobante.cliente_cuit,
      doc_tipo: comprobante.cliente_doc_tipo,
      doc_nro: comprobante.cliente_doc_nro,
    });

    const tipo = comprobante.tipo_comprobante || 'FACTURA C';
    const importe = Number(comprobante.total || comprobante.monto || 0);

    return {
      ver: 1,
      fecha: comprobante.fecha || new Date().toISOString().split('T')[0],
      cuit: parseInt(contribuyente.cuit, 10),
      ptoVta: Number(comprobante.punto_venta) || Number(contribuyente.punto_venta),
      tipoCmp: this.getCbteTipoEnum(tipo),
      nroCmp,
      importe,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: clienteDocData.docTipo,
      nroDocRec: clienteDocData.docNro,
      tipoCodAut: 'E',
      codAut: parseInt(comprobante.cae || '0', 10)
    };
  }
}
