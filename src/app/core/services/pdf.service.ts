import { Injectable } from '@angular/core';
import { supabase } from './supabase.service';

export interface PdfInfo {
  url: string;
  filename: string;
  title: string;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  
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
   * Descargar PDF usando proxy para evitar CORS
   */
  private async downloadPdfBlob(pdfUrl: string): Promise<Blob> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }

    const proxyUrl = `https://tejrdiwlgdzxsrqrqsbj.supabase.co/functions/v1/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error del proxy: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return blob.type !== 'application/pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob;
  }

  /**
   * Compartir PDF usando Web Share API con fallbacks inteligentes
   */
  async sharePdf(pdfInfo: PdfInfo): Promise<boolean> {
    const caps = this.capabilities;
    
    try {
      const pdfBlob = await this.downloadPdfBlob(pdfInfo.url);
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
        
        // Fallback: compartir URL
        if (navigator.canShare({ url: pdfInfo.url })) {
          await navigator.share({
            title: pdfInfo.title,
            text: `${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`,
            url: pdfInfo.url
          });
          return true;
        }
        
        // Fallback: solo texto
        await navigator.share({
          title: pdfInfo.title,
          text: `${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`
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
      return this.copyToClipboard(`${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`);
      
    } catch (error) {
      console.error('❌ Error en sharePdf:', error);
      return this.copyToClipboard(`${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`);
    }
  }

  /**
   * Descargar PDF con File System Access API o fallback automático
   */
  async downloadPdf(pdfInfo: PdfInfo): Promise<boolean> {
    try {
      const pdfBlob = await this.downloadPdfBlob(pdfInfo.url);
      
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
          
          alert('✅ PDF guardado exitosamente');
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
      window.open(pdfInfo.url, '_blank');
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
        alert('📋 Información copiada al portapapeles');
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
      alert('📋 Información copiada al portapapeles');
      return true;
    } catch (error) {
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
    const numeroSinCeros = this.getNumeroSinCeros(factura.numero_factura);
    const montoFormateado = this.formatearMonto(factura.monto);
    
    return {
      url: factura.pdf_url,
      filename: `Factura_${tipoComprobante.replace(' ', '')}_${numeroSinCeros}.pdf`,
      title: 'Factura Emitida',
      text: `Factura ${tipoComprobante} ${numeroSinCeros} - ${montoFormateado}`
    };
  }

  /**
   * Obtener tipo de comprobante formateado
   */
  private getTipoComprobante(factura: any): string {
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    return factura.tipo_comprobante || 'FC B';
  }

  /**
   * Obtener número de factura sin ceros iniciales
   */
  private getNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1];
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
