import { Injectable } from '@angular/core';
import { supabase } from './supabase.service';

export interface PdfShareOptions {
  title?: string;
  text?: string;
  filename?: string;
}

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
  get capabilities() {
    return {
      webShare: 'share' in navigator,
      canShare: 'canShare' in navigator,
      fileSystemAccess: 'showSaveFilePicker' in window,
      clipboard: 'clipboard' in navigator && 'writeText' in navigator.clipboard,
      isAndroid: /Android/i.test(navigator.userAgent),
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };
  }

  /**
   * Descarga PDF directamente sin proxy (para cuando no hay problemas CORS)
   */
  private async downloadPdfBlobDirect(pdfUrl: string): Promise<Blob> {
    const response = await fetch(pdfUrl, {
      method: 'GET',
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`Error descargando PDF: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    // Asegurar que el tipo MIME sea correcto
    if (blob.type !== 'application/pdf') {
      return new Blob([blob], { type: 'application/pdf' });
    }
    
    return blob;
  }

  /**
   * Descargar PDF usando proxy para evitar CORS
   */
  private async downloadPdfBlob(pdfUrl: string): Promise<Blob> {
    // Obtener session token para autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }

    // Usar pdf-proxy para evitar CORS
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
    // Asegurar que el tipo MIME sea correcto
    if (blob.type !== 'application/pdf') {
      return new Blob([blob], { type: 'application/pdf' });
    }
    return blob;
  }

  /**
   * Compartir PDF usando Web Share API nativa
   */
  async sharePdf(pdfInfo: PdfInfo): Promise<boolean> {
    const caps = this.capabilities;
    
    try {
      // Descargar el PDF como blob
      const pdfBlob = await this.downloadPdfBlob(pdfInfo.url);
      
      // Crear File object para Web Share API
      const file = new File([pdfBlob], pdfInfo.filename, { 
        type: 'application/pdf',
        lastModified: Date.now()
      });

      // Intentar Web Share API con archivos (Android 10+, iOS 14+)
      if (caps.webShare && caps.canShare) {
        try {
          const canShareFiles = navigator.canShare({ files: [file] });
          if (canShareFiles) {
            await navigator.share({
              title: pdfInfo.title,
              text: pdfInfo.text,
              files: [file]
            });
            return true;
          }
        } catch (fileShareError) {
        }
        
        // Fallback: compartir solo la URL
        try {
          const canShareUrl = navigator.canShare({ url: pdfInfo.url });
          if (canShareUrl) {
            await navigator.share({
              title: pdfInfo.title,
              text: `${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`,
              url: pdfInfo.url
            });
            return true;
          }
        } catch (urlShareError) {
        }
        
        // Fallback: compartir solo texto
        try {
          await navigator.share({
            title: pdfInfo.title,
            text: `${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`
          });
          return true;
        } catch (textShareError) {
        }
      }
      
      // Fallback final: estrategia específica para Android
      if (caps.isAndroid) {
        return await this.shareAndroidFallback(pdfBlob, pdfInfo);
      }
      
      // Fallback para otros dispositivos
      return await this.shareGenericFallback(pdfInfo);
      
    } catch (error) {
      console.error('❌ Error en sharePdf:', error);
      return await this.shareGenericFallback(pdfInfo);
    }
  }

  /**
   * Estrategia específica para Android cuando Web Share API falla
   */
  private async shareAndroidFallback(pdfBlob: Blob, pdfInfo: PdfInfo): Promise<boolean> {
    
    try {
      // Crear URL temporal para el blob
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      // Mostrar opciones al usuario
      const message = `${pdfInfo.title}\n${pdfInfo.text}\n\n¿Cómo deseas compartir?`;
      const userChoice = confirm(`${message}\n\nOK = Abrir PDF para compartir manualmente\nCancelar = Copiar información al portapapeles`);
      
      if (userChoice) {
        window.open(blobUrl, '_blank');
        
        // Mostrar instrucciones específicas para Android
        setTimeout(() => {
          alert(`📱 PDF abierto\n\nPara compartir en Android:\n• Toca ⋮ (menú)\n• Selecciona "Compartir"\n• Elige la app destino`);
        }, 1500);
        
        // Limpiar URL después de un tiempo
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        
      } else {
        const textToCopy = `${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`;
        
        if (this.capabilities.clipboard) {
          await navigator.clipboard.writeText(textToCopy);
          alert('📋 Información copiada al portapapeles');
        } else {
          // Fallback para portapapeles
          this.showCopyFallback(textToCopy);
        }
        
        URL.revokeObjectURL(blobUrl);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error en Android fallback:', error);
      return false;
    }
  }

  /**
   * Fallback genérico para dispositivos sin Web Share API
   */
  private async shareGenericFallback(pdfInfo: PdfInfo): Promise<boolean> {
    console.log('📋 Usando fallback genérico');
    
    const textToCopy = `${pdfInfo.text}\n\nPDF: ${pdfInfo.url}`;
    
    if (this.capabilities.clipboard) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        alert('📋 Información de la factura copiada al portapapeles');
        return true;
      } catch (error) {
        console.warn('⚠️ Error copiando al portapapeles:', error);
      }
    }
    
    // Fallback final: mostrar información
    this.showCopyFallback(textToCopy);
    return true;
  }

  /**
   * Mostrar información cuando no se puede copiar al portapapeles
   */
  private showCopyFallback(text: string): void {
    // Crear un textarea temporal para seleccionar el texto
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
    } catch (error) {
      alert(`📄 Información de la factura:\n\n${text}`);
    }
    
    document.body.removeChild(textarea);
  }

  /**
   * Descargar PDF con File System Access API o fallback
   */
  async downloadPdf(pdfInfo: PdfInfo): Promise<boolean> {
    console.log('💾 Iniciando descarga PDF:', pdfInfo.filename);
    const caps = this.capabilities;
    
    try {
      // Descargar el PDF como blob
      const pdfBlob = await this.downloadPdfBlob(pdfInfo.url);
      
      // File System Access API (Chrome 86+)
      if (caps.fileSystemAccess) {
        console.log('💾 Usando File System Access API');
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
          
          console.log('✅ PDF guardado con File System Access API');
          alert('✅ PDF guardado exitosamente');
          return true;
          
        } catch (fsError) {
          if (fsError instanceof Error && fsError.name !== 'AbortError') {
            console.warn('⚠️ Error en File System Access API:', fsError);
          }
          // Continuar con fallback si no es cancelación del usuario
        }
      }
      
      // Fallback: descarga automática
      console.log('💾 Usando descarga automática');
      this.downloadFallback(pdfBlob, pdfInfo.filename);
      return true;
      
    } catch (error) {
      console.error('❌ Error descargando PDF:', error);
      // Fallback final: abrir URL original
      window.open(pdfInfo.url, '_blank');
      return false;
    }
  }

  /**
   * Descarga automática (fallback)
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
    console.log('✅ PDF descargado automáticamente');
  }

  /**
   * Imprimir PDF con técnica mejorada para Android
   */
  async printPdf(pdfInfo: PdfInfo): Promise<boolean> {
    console.log('🖨️ Iniciando impresión PDF:', pdfInfo.filename);
    console.log('🖨️ DEBUG - PdfInfo recibido:', pdfInfo);
    console.log('🖨️ DEBUG - URL:', pdfInfo.url);
    const caps = this.capabilities;
    
    try {
      if (caps.isAndroid) {
        // Estrategia específica para Android
        return await this.printAndroid(pdfInfo);
      } else {
        // Estrategia para desktop/otros
        return await this.printDesktop(pdfInfo);
      }
      
    } catch (error) {
      console.error('❌ Error imprimiendo PDF:', error);
      // Fallback: abrir URL original
      window.open(pdfInfo.url, '_blank');
      return false;
    }
  }

  /**
   * Impresión específica para Android
   */
  private async printAndroid(pdfInfo: PdfInfo): Promise<boolean> {
    console.log('📱 Impresión Android');
    
    // Descargar PDF usando proxy para evitar CORS
    const pdfBlob = await this.downloadPdfBlob(pdfInfo.url);
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    // Mostrar instrucciones y abrir PDF
    const confirmPrint = confirm(
      `🖨️ Impresión en Android\n\n` +
      `1. Se abrirá el PDF\n` +
      `2. Toca ⋮ (menú) en Chrome\n` +
      `3. Selecciona "Imprimir"\n` +
      `4. Elige impresora o "Guardar como PDF"\n\n` +
      `¿Continuar?`
    );
    
    if (confirmPrint) {
      // Abrir PDF con parámetros para impresión
      const printUrl = `${blobUrl}#toolbar=1&navpanes=0&scrollbar=0&view=FitH`;
      window.open(printUrl, '_blank');
      
      // Mostrar recordatorio después de abrir
      setTimeout(() => {
        alert('📱 PDF abierto\n\nAhora usa: ⋮ → Imprimir');
      }, 2000);
      
      // Limpiar URL después de un tiempo
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      
      return true;
    }
    
    URL.revokeObjectURL(blobUrl);
    return false;
  }

  /**
   * Impresión para desktop
   */
  private async printDesktop(pdfInfo: PdfInfo): Promise<boolean> {
    console.log('🖥️ Impresión desktop');
    
    // Descargar PDF usando proxy para evitar CORS
    const pdfBlob = await this.downloadPdfBlob(pdfInfo.url);
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    // Crear iframe oculto para impresión
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = blobUrl;
    
    document.body.appendChild(iframe);
    
    return new Promise((resolve) => {
      iframe.onload = () => {
        console.log('🖨️ PDF cargado en iframe, iniciando impresión');
        
        try {
          // Intentar imprimir directamente
          iframe.contentWindow?.print();
          resolve(true);
        } catch (printError) {
          console.warn('⚠️ No se pudo imprimir automáticamente:', printError);
          // Fallback: abrir en nueva ventana
          window.open(blobUrl, '_blank');
          resolve(false);
        }
        
        // Limpiar después de un tiempo
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        }, 3000);
      };

      iframe.onerror = () => {
        console.error('❌ Error cargando PDF en iframe');
        window.open(blobUrl, '_blank');
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        URL.revokeObjectURL(blobUrl);
        resolve(false);
      };
    });
  }

  /**
   * Abrir PDF (simple pero efectivo)
   */
  openPdf(pdfUrl: string): void {
    console.log('📄 Abriendo PDF:', pdfUrl);
    window.open(pdfUrl, '_blank');
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
   * Métodos helper para formatear datos
   */
  private getTipoComprobante(factura: any): string {
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    return factura.tipo_comprobante || 'FC B';
  }

  private getNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1];
    }
    return numeroCompleto?.replace(/^0+/, '') || '0';
  }

  private formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }
}
