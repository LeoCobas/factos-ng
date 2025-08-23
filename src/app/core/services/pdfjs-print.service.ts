import { Injectable } from '@angular/core';
import { supabase } from './supabase.service';

// PDF.js tipos usando el archivo centralizado
/// <reference path="../../../types/pdfjs.d.ts" />

export interface DirectPrintOptions {
  url: string;           // URL del PDF
  filename: string;      // Nombre del archivo (para logs)
  title?: string;        // Título (para logs)
}

@Injectable({
  providedIn: 'root'
})
export class PdfJsPrintService {
  
  private pdfLibLoaded = false;

  /**
   * Inicializar PDF.js si no está cargado
   */
  private async ensurePdfJsLoaded(): Promise<void> {
    if (this.pdfLibLoaded && window.pdfjsLib) {
      console.log('📚 [DEBUG] PDF.js ya está cargado');
      return;
    }

    console.log('📚 [DEBUG] Inicializando PDF.js v5.4.54 para impresión directa...');
    
    // Cargar PDF.js si no está disponible
    if (!window.pdfjsLib) {
      console.log('⏳ [DEBUG] Cargando PDF.js desde CDN...');
      await this.loadPdfJsLibrary();
      
      if (!window.pdfjsLib) {
        throw new Error('No se pudo cargar PDF.js desde ningún CDN');
      }
      console.log('✅ [DEBUG] PDF.js library cargada');
    }
    
    // Configurar el worker
    console.log('🔧 [DEBUG] Configurando worker...');
    this.setupWorker();
    console.log('✅ [DEBUG] Worker configurado');
    
    this.pdfLibLoaded = true;
    console.log('✅ PDF.js configurado exitosamente para impresión');
  }

  /**
   * Cargar biblioteca PDF.js desde CDN
   */
  private async loadPdfJsLibrary(): Promise<void> {
    // URLs de PDF.js v5.4.54 (versión estable más reciente)
    const cdnSources = [
      {
        name: 'jsDelivr',
        main: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.min.mjs',
        worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs'
      },
      {
        name: 'UNPKG',
        main: 'https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.min.mjs',
        worker: 'https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs'
      }
    ];
    
    for (const cdn of cdnSources) {
      try {
        console.log(`🔄 Intentando cargar desde ${cdn.name}...`);
        
        // Para ES modules (.mjs), necesitamos usar import dinámico
        const module = await import(/* @vite-ignore */ cdn.main);
        
        // Asignar pdfjsLib al objeto global
        window.pdfjsLib = module;
        
        // Guardar la URL del worker
        (window as any).pdfWorkerSrc = cdn.worker;
        
        console.log(`✅ PDF.js v5.4.54 cargado desde ${cdn.name}`);
        return;
        
      } catch (error) {
        console.warn(`⚠️ Error cargando desde ${cdn.name}:`, error);
        continue;
      }
    }
    
    throw new Error('No se pudo cargar PDF.js desde ningún CDN');
  }

  /**
   * Configurar worker de PDF.js
   */
  private setupWorker(): void {
    const workerSrc = (window as any).pdfWorkerSrc || 
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs';
    
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    console.log('✅ Worker configurado:', workerSrc);
  }

  /**
   * Método principal para imprimir PDF directamente usando PDF.js Canvas
   * Compatible con Android y optimizado para facturas
   */
  async printPdfDirect(options: DirectPrintOptions): Promise<void> {
    try {
      console.log(`🖨️ [DEBUG] Iniciando impresión directa con PDF.js:`, options.filename);
      console.log(`🖨️ [DEBUG] URL del PDF:`, options.url);
      
      // Asegurar que PDF.js esté cargado
      console.log(`🖨️ [DEBUG] Cargando PDF.js...`);
      await this.ensurePdfJsLoaded();
      console.log(`🖨️ [DEBUG] PDF.js cargado exitosamente`);
      
      // Cargar el PDF
      console.log(`🖨️ [DEBUG] Cargando documento PDF...`);
      const pdfDocument = await this.loadPdf(options.url);
      console.log(`🖨️ [DEBUG] Documento PDF cargado:`, pdfDocument.numPages, 'páginas');
      
      if (pdfDocument.numPages < 1) {
        throw new Error('El PDF no tiene páginas para imprimir');
      }
      
      // Obtener solo la primera página (facturas)
      console.log(`🖨️ [DEBUG] Obteniendo primera página...`);
      const page = await pdfDocument.getPage(1);
      console.log(`🖨️ [DEBUG] Primera página obtenida`);
      
      // Renderizar página a canvas con alta calidad
      console.log(`🖨️ [DEBUG] Renderizando página a canvas...`);
      const { imageDataUrl, width, height } = await this.renderPageToCanvas(page);
      console.log(`🖨️ [DEBUG] Canvas renderizado. Dimensiones: ${width}x${height}`);
      console.log(`🖨️ [DEBUG] Data URL generado (primeros 100 chars):`, imageDataUrl.substring(0, 100));
      
      // Imprimir directamente usando la MISMA lógica del visor PDF.js
      console.log(`🖨️ [DEBUG] Abriendo ventana de impresión...`);
      this.openDirectPrintWindow(imageDataUrl, width, height);
      console.log(`🖨️ [DEBUG] Ventana de impresión abierta`);
      
      // Limpiar recursos
      pdfDocument.destroy();
      
      console.log('✅ Impresión directa completada');
      
    } catch (error) {
      console.error('❌ [ERROR] Error en impresión directa:', error);
      console.error('❌ [ERROR] Stack trace:', error instanceof Error ? error.stack : 'No stack available');
      
      // Determinar tipo de error para mejor debugging
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          console.error('❌ [ERROR] Problema CORS detectado - PDF externo no accesible');
        } else if (error.message.includes('HTTP Error')) {
          console.error('❌ [ERROR] Problema de red o servidor');
        } else {
          console.error('❌ [ERROR] Error de PDF.js o rendering');
        }
      }
      
      // Fallback: abrir PDF original
      console.log('🔄 [FALLBACK] Abriendo PDF original en nueva ventana');
      window.open(options.url, '_blank');
      
      throw error;
    }
  }

  /**
   * Cargar documento PDF usando el pdf-proxy de Supabase (evita CORS + reutiliza código)
   */
  private async loadPdf(pdfUrl: string): Promise<any> {
    try {
      console.log('📄 [DEBUG] Cargando PDF:', pdfUrl);
      console.log('📄 [DEBUG] window.pdfjsLib disponible:', !!window.pdfjsLib);
      console.log('📄 [DEBUG] getDocument disponible:', !!window.pdfjsLib?.getDocument);
      
      // SOLUCIÓN ELEGANTE: Usar el pdf-proxy existente de Supabase
      console.log('🔄 [DEBUG] Descargando PDF usando pdf-proxy de Supabase...');
      const arrayBuffer = await this.downloadPdfArrayBuffer(pdfUrl);
      console.log('✅ [DEBUG] ArrayBuffer obtenido del proxy, tamaño:', arrayBuffer.byteLength, 'bytes');
      
      // Cargar PDF desde ArrayBuffer en lugar de URL
      const loadingTask = window.pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0 // Reducir logs de PDF.js
      });
      
      console.log('📄 [DEBUG] LoadingTask creado desde ArrayBuffer:', !!loadingTask);
      
      const pdfDocument = await loadingTask.promise;
      console.log(`✅ [DEBUG] PDF cargado exitosamente: ${pdfDocument.numPages} páginas`);
      
      return pdfDocument;
      
    } catch (error) {
      console.error('❌ [ERROR] Error cargando PDF:', error);
      console.error('❌ [ERROR] URL que falló:', pdfUrl);
      console.error('❌ [ERROR] Tipo de error:', error instanceof TypeError ? 'TypeError (posible CORS)' : 'Otro error');
      console.error('❌ [ERROR] window.pdfjsLib:', window.pdfjsLib);
      throw new Error(`No se pudo cargar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Descargar PDF usando el pdf-proxy de Supabase (reutiliza lógica existente)
   */
  private async downloadPdfArrayBuffer(pdfUrl: string): Promise<ArrayBuffer> {
    // Obtener session token para autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }

    // Usar el mismo pdf-proxy que ya existe en el sistema
    const proxyUrl = `https://tejrdiwlgdzxsrqrqsbj.supabase.co/functions/v1/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
    console.log('🌐 [DEBUG] Usando pdf-proxy:', proxyUrl);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error del pdf-proxy: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('✅ [DEBUG] PDF descargado exitosamente del proxy');
    
    return arrayBuffer;
  }

  /**
   * Renderizar página a canvas y obtener imagen (EXACTA implementación del visor PDF.js)
   */
  private async renderPageToCanvas(page: any): Promise<{imageDataUrl: string, width: number, height: number}> {
    try {
      // Configurar viewport para impresión optimizada (EXACTO como el visor)
      const viewport = page.getViewport({ 
        scale: 2.0,      // MISMA escala que el visor PDF.js
        rotation: 0 
      });

      // Crear canvas temporal
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Renderizar la página en el canvas (EXACTO como el visor)
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Convertir canvas a imagen de alta calidad (EXACTO como el visor)
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      console.log('✅ Página renderizada a canvas (usando lógica del visor PDF.js)');
      
      return {
        imageDataUrl: dataUrl,
        width: viewport.width,
        height: viewport.height
      };
      
    } catch (error) {
      console.error('❌ Error renderizando página:', error);
      throw new Error(`Error renderizando la página: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Abrir ventana de impresión directa (EXACTA implementación del visor PDF.js)
   */
  private openDirectPrintWindow(imageDataUrl: string, width: number, height: number): void {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      console.error('No se pudo abrir la ventana de impresión');
      return;
    }

    // HTML EXACTO del visor PDF.js que funciona perfecto en Android
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Imprimir Factura</title>
        <style>
          @page { margin: 5mm; size: auto; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 0; 
            background: white; 
            display: flex; 
            justify-content: center; 
            align-items: flex-start; 
          }
          .print-container { 
            width: 100%; 
            max-width: ${Math.min(width * 0.5, 400)}px; 
            text-align: center; 
          }
          .print-image { 
            width: 100%; 
            height: auto; 
            display: block; 
            margin: 0 auto; 
          }
          @media print {
            .print-image { 
              max-width: 100% !important; 
              page-break-inside: avoid; 
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <img src="${imageDataUrl}" alt="Factura" class="print-image" />
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  /**
   * Detectar si el dispositivo es Android
   */
  private get isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  /**
   * Detectar si es dispositivo móvil
   */
  private get isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}
