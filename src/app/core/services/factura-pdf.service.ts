import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Contribuyente, Comprobante } from '../types/database.types';

// Inicializar fuentes virtuales de pdfMake
(pdfMake as any).vfs = (pdfFonts as any).vfs;

@Injectable({
  providedIn: 'root'
})
export class FacturaPdfService {

  constructor() {}

  /**
   * Genera el PDF en memoria y devuelve un Blob
   */
  async generarFacturaPdf(contribuyente: Contribuyente, comprobante: Comprobante): Promise<Blob> {
    const docDefinition = this.crearDefinicionDocumento(contribuyente, comprobante);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    return await pdfDocGenerator.getBlob();
  }

  /**
   * Crea el árbol de definición de objeto que entiende pdfmake para un formato Ticket 80mm
   */
  private crearDefinicionDocumento(contribuyente: Contribuyente, comprobante: Comprobante): TDocumentDefinitions {
    const esFacturaC = comprobante.tipo_comprobante.includes('C');
    const letra = esFacturaC ? 'C' : 'B';
    const numComp = comprobante.numero_comprobante.padEnd(13, ' '); // Formato: 0004-00000012
    const fechaFormat = this.formatearFechaArg(comprobante.fecha);
    
    // QR Code
    const qrData = this.generarQrData(contribuyente, comprobante);
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(qrData))}`;

    return {
      pageSize: { width: 226, height: 'auto' }, // 80mm = 226 pt aprox (80 / 25.4 * 72)
      pageMargins: [10, 15, 10, 15],
      defaultStyle: {
        fontSize: 8,
        font: 'Roboto'
      },
      content: [
        // ================= HEADER DEL TICKET =================
        { 
          text: contribuyente.razon_social.toUpperCase(), 
          style: 'header',
          alignment: 'center'
        },
        { 
          text: '---------------------------------------------------------', 
          alignment: 'center', 
          margin: [0, 5, 0, 5] 
        },
        { text: `CUIT: ${this.formatearCuit(contribuyente.cuit)}`, alignment: 'center' },
        { text: `Condición frente al IVA: ${esFacturaC ? 'Responsable Monotributo' : 'IVA Responsable Inscripto'}`, alignment: 'center' },
        { 
          text: '---------------------------------------------------------', 
          alignment: 'center', 
          margin: [0, 5, 0, 5] 
        },
        
        // ================= TIPO COMPROBANTE =================
        {
          columns: [
            {
              width: '*',
              text: comprobante.tipo_comprobante,
              bold: true,
              fontSize: 10
            },
            {
              width: 'auto',
              text: `Cod. ${this.getCbteTipoEnum(comprobante.tipo_comprobante).toString().padStart(3, '0')}`,
              alignment: 'right'
            }
          ]
        },
        { text: `Nro: ${numComp}` },
        { text: `Fecha: ${fechaFormat}` },
        { 
          text: '---------------------------------------------------------', 
          alignment: 'center', 
          margin: [0, 5, 0, 5] 
        },

        // ================= DATOS CLIENTE =================
        { text: 'A C O N S U M I D O R  F I N A L', alignment: 'center', bold: true },
        { 
          text: '---------------------------------------------------------', 
          alignment: 'center', 
          margin: [0, 5, 0, 5] 
        },

        // ================= DETALLE =================
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              // Header tabla
              [
                { text: 'CONCEPTO', bold: true }, 
                { text: 'SUBTOTAL', bold: true, alignment: 'right' }
              ],
              // Fila producto/servicio único
              [
                { text: comprobante.concepto || contribuyente.concepto || 'Varios' }, 
                { text: `$${comprobante.total.toFixed(2)}`, alignment: 'right' }
              ]
            ]
          },
          layout: 'lightHorizontalLines'
        },

        { text: ' ', margin: [0, 5, 0, 5] }, // Espacio

        // ================= TOTAL =================
        {
          columns: [
            { text: 'TOTAL:', bold: true, fontSize: 12 },
            { text: `$${comprobante.total.toFixed(2)}`, bold: true, fontSize: 12, alignment: 'right' }
          ]
        },

        { 
          text: '---------------------------------------------------------', 
          alignment: 'center', 
          margin: [0, 10, 0, 5] 
        },

        // ================= AFIP FOOTER =================
        { text: 'Comprobante Autorizado por AFIP', alignment: 'center', italics: true, fontSize: 7 },
        { text: `CAE: ${comprobante.cae || 'N/D'}`, alignment: 'center', fontSize: 7 },
        { text: `Vto. CAE: ${this.formatearFechaArg(comprobante.vencimiento_cae) || 'N/D'}`, alignment: 'center', fontSize: 7 },
        
        {
          qr: qrUrl,
          fit: 90,
          alignment: 'center',
          margin: [0, 10, 0, 10] // top space
        }
      ],
      styles: {
        header: {
          fontSize: 12,
          bold: true
        }
      }
    };
  }

  private formatearCuit(cuit: string): string {
    if (!cuit || cuit.length !== 11) return cuit;
    return `${cuit.substring(0, 2)}-${cuit.substring(2, 10)}-${cuit.substring(10, 11)}`;
  }

  private formatearFechaArg(fechaIso: string | null): string {
    if (!fechaIso) return '';
    // if YYYYMMDD from AFIP (like Vto. CAE)
    if (fechaIso.length === 8 && !fechaIso.includes('-')) {
      const year = fechaIso.substring(0, 4);
      const month = fechaIso.substring(4, 6);
      const day = fechaIso.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    // if YYYY-MM-DD
    const match = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return fechaIso;
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
      'NOTA DE CREDITO C': 13,
    };
    return tipos[tipoComprobante.toUpperCase()] || 11;
  }

  private generarQrData(contribuyente: Contribuyente, comprobante: Comprobante): any {
    // Requisito AFIP para el código QR
    // ver: 1
    // fecha: YYYY-MM-DD del comprobante
    // cuit: Number
    // ptoVta: Number
    // tipoCmp: Number
    // nroCmp: Number
    // importe: Number
    // moneda: "PES"
    // ctz: 1
    // tipoDocRec: 99 (Consumidor final)
    // nroDocRec: 0
    // tipoCodAut: "E"
    // codAut: Number (CAE)
    
    // Parse nroCmp (ex: "0004-00000012" -> 12)
    const nroCmpStr = comprobante.numero_comprobante.split('-').pop() || '1';
    const nroCmp = parseInt(nroCmpStr, 10);

    return {
      ver: 1,
      fecha: comprobante.fecha,  // YYYY-MM-DD format is in 'fecha' typically
      cuit: parseInt(contribuyente.cuit, 10),
      ptoVta: Number(comprobante.punto_venta) || Number(contribuyente.punto_venta),
      tipoCmp: this.getCbteTipoEnum(comprobante.tipo_comprobante),
      nroCmp: nroCmp,
      importe: Number(comprobante.total),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: 'E',
      codAut: parseInt(comprobante.cae || '0', 10)
    };
  }
}
