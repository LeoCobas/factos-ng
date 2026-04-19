import { Injectable, inject } from '@angular/core';
import { FacturaPdfService } from './factura-pdf.service';
import { ContribuyenteService } from './contribuyente.service';
import { PdfJsPrintService } from './pdfjs-print.service';

export interface PdfInfo {
  filename: string;
  title: string;
  text: string;
  factura: any; // Se pasa el objeto factura completo para generarlo en tiempo real
}

export interface PdfAsset {
  blob: Blob;
  blobUrl: string;
  info: PdfInfo;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  private facturaPdfService = inject(FacturaPdfService);
  private contribuyenteService = inject(ContribuyenteService);
  private pdfJsPrintService = inject(PdfJsPrintService);

  constructor() {}

  /**
   * Detectar capacidades del navegador
   */
  private get capabilities() {
    return {
      webShare: 'share' in navigator,
      canShare: 'canShare' in navigator,
      fileSystemAccess: 'showSaveFilePicker' in window,
      clipboard: 'clipboard' in navigator && 'writeText' in navigator.clipboard,
      isAndroid: /Android/i.test(navigator.userAgent)
    };
  }

  /**
   * Generar el PDF Blob on-the-fly
   */
  async getPdfBlob(factura: any): Promise<Blob> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      throw new Error('Configuración de contribuyente no disponible');
    }
    return await this.facturaPdfService.generarFacturaPdf(contribuyente, factura);
  }

  async createPdfAsset(factura: any): Promise<PdfAsset> {
    const info = this.createPdfInfo(factura);
    const blob = await this.getPdfBlob(factura);
    const blobUrl = URL.createObjectURL(blob);

    return { blob, blobUrl, info };
  }

  revokeBlobUrl(blobUrl?: string | null): void {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }

  /**
   * Compartir PDF usando Web Share API con fallbacks inteligentes
   */
  async sharePdf(pdfInfo: PdfInfo): Promise<boolean> {
    const caps = this.capabilities;
    
    try {
      const pdfBlob = await this.getPdfBlob(pdfInfo.factura);
      const file = new File([pdfBlob], pdfInfo.filename, { 
        type: 'application/pdf',
        lastModified: Date.now()
      });

      // Intentar Web Share API con archivos
      if (caps.webShare && caps.canShare) {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: pdfInfo.title,
            text: pdfInfo.text,
            files: [file]
          });
          return true;
        }
        
        // Fallback: solo texto
        await navigator.share({
          title: pdfInfo.title,
          text: pdfInfo.text
        });
        return true;
      }
      
      // Fallback para Android sin Web Share API
      if (caps.isAndroid) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return true;
      }
      
      // Fallback final: copiar al portapapeles
      return this.copyToClipboard(pdfInfo.text);
      
    } catch (error) {
      console.error('❌ Error en sharePdf:', error);
      return this.copyToClipboard(pdfInfo.text);
    }
  }

  /**
   * Descargar PDF con File System Access API o fallback automático
   */
  async downloadPdf(pdfInfo: PdfInfo): Promise<boolean> {
    try {
      const pdfBlob = await this.getPdfBlob(pdfInfo.factura);
      
      // Intentar File System Access API (Chrome 86+)
      if (this.capabilities.fileSystemAccess) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: pdfInfo.filename,
            types: [{
              description: 'PDF files',
              accept: { 'application/pdf': ['.pdf'] }
            }]
          });
          
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBlob);
          await writable.close();
          
          alert('✅ Ticket guardado exitosamente');
          return true;
          
        } catch (fsError) {
          if (fsError instanceof Error && fsError.name === 'AbortError') {
            return false; // Usuario canceló
          }
        }
      }
      
      // Fallback: descarga automática
      this.downloadFallback(pdfBlob, pdfInfo.filename);
      return true;
      
    } catch (error) {
      console.error('❌ Error descargando PDF:', error);
      alert('Error al generar el PDF del ticket');
      return false;
    }
  }

  /**
   * Descarga automática usando elemento <a>
   */
  private downloadFallback(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Copiar texto al portapapeles con fallback
   */
  private async copyToClipboard(text: string): Promise<boolean> {
    if (this.capabilities.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        alert('📋 Información de Factura copiada al portapapeles');
        return true;
      } catch (error) {
        console.warn('⚠️ Error copiando al portapapeles:', error);
      }
    }
    
    // Fallback: usar documento.execCommand
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      document.execCommand('copy');
      alert('📋 Información de Factura copiada al portapapeles');
      return true;
    } catch {
      alert(`📄 Información de la factura:\n\n${text}`);
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  /**
   * Crear información de PDF desde datos de factura
   */
  createPdfInfo(factura: any): PdfInfo {
    const tipoComprobante = this.getTipoComprobante(factura);
    const numeroSinCeros = this.getNumeroSinCeros(factura.numero_comprobante || factura.numero_factura);
    const montoFormateado = this.formatearMonto(factura.total || factura.monto);
    
    return {
      factura: factura,
      filename: `Ticket_${tipoComprobante.replace(' ', '')}_${numeroSinCeros}.pdf`,
      title: 'Ticket de Venta Emitido',
      text: `Ticket ${tipoComprobante} ${numeroSinCeros} - ${montoFormateado}`
    };
  }

  async printFactura(factura: any): Promise<void> {
    const asset = await this.createPdfAsset(factura);

    try {
      await this.pdfJsPrintService.printPdfDirect({
        url: asset.blobUrl,
        filename: asset.info.filename,
        title: asset.info.title
      });
    } finally {
      setTimeout(() => this.revokeBlobUrl(asset.blobUrl), 10000);
    }
  }

  /**
   * Obtener tipo de comprobante formateado
   */
  private getTipoComprobante(factura: any): string {
    if (factura.tipo_comprobante === 'FACTURA A') return 'FC A';
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO A') return 'NC A';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO B') return 'NC B';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO C') return 'NC C';
    return factura.tipo_comprobante || 'FC B';
  }

  /**
   * Obtener número de factura sin ceros iniciales
   */
  private getNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1].replace(/^0+/, '');
    }
    return numeroCompleto?.replace(/^0+/, '') || '0';
  }

  /**
   * Formatear monto en pesos argentinos
   */
  private formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }
}
