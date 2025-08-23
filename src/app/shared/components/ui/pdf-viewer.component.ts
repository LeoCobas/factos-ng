import { Component, input, signal, AfterViewInit, ViewChild, ElementRef, OnDestroy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { supabase } from '../../../core/services/supabase.service';

// PDF.js tipos usando el archivo centralizado
/// <reference path="../../../../types/pdfjs.d.ts" />

export interface PdfViewerConfig {
  url: string;           // URL del PDF (blob URL local o URL externa)
  title: string;         // Título para mostrar
  filename: string;      // Nombre del archivo
}

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div class="flex-1 min-w-0 w-full sm:w-auto">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {{ config().title }}
          </h3>
          <!-- Eliminado: texto de página actual -->
        </div>
        
        <!-- Controles -->
        <div class="flex items-center gap-1 sm:gap-2 flex-wrap w-full sm:w-auto justify-end">
          <!-- Controles de zoom -->
          <button 
            (click)="zoomOut()"
            [disabled]="scale() <= 0.5"
            class="p-1.5 sm:p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Alejar">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
            </svg>
          </button>
          
          <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 min-w-8 sm:min-w-12 text-center px-1">
            {{ Math.round(scale() * 100) }}%
          </span>
          
          <button 
            (click)="zoomIn()"
            [disabled]="scale() >= 3"
            class="p-1.5 sm:p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Acercar">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
          </button>
          
          <!-- Botón imprimir -->
          <button 
            (click)="printFirstPage()"
            class="p-1.5 sm:p-2 rounded bg-orange-500 hover:bg-orange-600 text-white"
            title="Imprimir primera página">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
          </button>
          
          <!-- Botón cerrar -->
          <button 
            (click)="close()"
            class="p-1.5 sm:p-2 rounded bg-red-500 hover:bg-red-600 text-white"
            title="Cerrar">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Área del PDF -->
      <div class="flex-1 overflow-auto relative">
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center p-4">
              <div class="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mb-2 sm:mb-4"></div>
              <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">Cargando PDF...</p>
            </div>
          </div>
        }
        
        @if (error()) {
          <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="text-center max-w-md mx-auto p-4 sm:p-6">
              <div class="text-red-500 mb-2 sm:mb-4">
                <svg class="w-8 h-8 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h4 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Error al cargar PDF</h4>
              <p class="text-gray-600 dark:text-gray-400 mb-4 text-xs sm:text-sm">{{ error() }}</p>
              <button 
                (click)="retryLoad()"
                class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded transition-colors text-sm sm:text-base">
                Reintentar
              </button>
            </div>
          </div>
        }
        
        <!-- Canvas para renderizar PDF -->
        <div class="flex justify-center p-2 sm:p-4">
          <canvas 
            #pdfCanvas
            [style.display]="loading() || error() ? 'none' : 'block'"
            class="max-w-full shadow-lg border border-gray-200 dark:border-gray-700">
          </canvas>
        </div>
      </div>
    </div>
  `,
  styles: [`
    canvas {
      max-width: 100%;
      height: auto;
    }
    
    /* Mejoras responsive para mobile */
    @media (max-width: 640px) {
      .print-container {
        padding: 8px !important;
      }
      
      /* Asegurar que los botones sean tocables en mobile */
      button {
        min-height: 44px;
        min-width: 44px;
      }
      
      /* Mejorar legibilidad en pantallas pequeñas */
      .text-container {
        font-size: 14px !important;
        line-height: 1.4;
      }
    }
  `]
})
export class PdfViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pdfCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  // Inputs
  config = input.required<PdfViewerConfig>();
  
  // Outputs
  closeRequested = output<void>();
  
  // State signals
  loading = signal(true);
  error = signal<string | null>(null);
  currentPage = signal(1);
  totalPages = signal(0);
  scale = signal(1);
  
  // PDF.js objects
  private pdfDocument: any = null;
  private currentPageObject: any = null;
  
  // Device capabilities
  private get isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }
  
  private get isMobile() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // Computed
  Math = Math; // Para usar en template
  
  ngAfterViewInit() {
    this.initializePdfJs();
  }
  
  ngOnDestroy() {
    this.cleanup();
  }
  
  private async initializePdfJs() {
    try {
      console.log('📚 Inicializando PDF.js v5.4.54...');
      
      // Cargar PDF.js si no está disponible
      if (!window.pdfjsLib) {
        console.log('⏳ Cargando PDF.js desde CDN...');
        await this.loadPdfJsLibrary();
        
        if (!window.pdfjsLib) {
          throw new Error('No se pudo cargar PDF.js desde ningún CDN');
        }
      }
      
      // Configurar el worker
      this.setupWorker();
      
      console.log('✅ PDF.js configurado exitosamente');
      
      await this.loadPdf();
    } catch (error) {
      console.error('❌ Error inicializando PDF.js:', error);
      this.error.set(`Error cargando PDF.js: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      this.loading.set(false);
    }
  }
  
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
        const module = await import(cdn.main);
        
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
  
  private setupWorker(): void {
    const workerSrc = (window as any).pdfWorkerSrc || 
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs';
    
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    console.log('✅ Worker configurado:', workerSrc);
  }

  /**
   * Descargar PDF usando el pdf-proxy de Supabase (reutiliza lógica del servicio de impresión)
   */
  private async downloadPdfArrayBuffer(pdfUrl: string): Promise<ArrayBuffer> {
    // Obtener session token para autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }

    // Usar el mismo pdf-proxy que ya existe en el sistema
    const proxyUrl = `https://tejrdiwlgdzxsrqrqsbj.supabase.co/functions/v1/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
    console.log('🌐 [DEBUG] PDF Viewer usando pdf-proxy:', proxyUrl);
    
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
    console.log('✅ [DEBUG] PDF descargado exitosamente del proxy para el visor');
    
    return arrayBuffer;
  }
  
  private async loadPdf() {
    try {
      this.loading.set(true);
      this.error.set(null);
      
      const pdfUrl = this.config().url;
      console.log('📄 Cargando PDF:', pdfUrl);
      
      let loadingTask: any;
      
      // Detectar si es una blob URL local o una URL externa
      if (pdfUrl.startsWith('blob:')) {
        console.log('🔗 [DEBUG] Detectada blob URL local, cargando directamente...');
        // Para blob URLs locales, cargar directamente sin proxy
        loadingTask = window.pdfjsLib.getDocument({
          url: pdfUrl,
          verbosity: 0
        });
      } else {
        console.log('🌐 [DEBUG] Detectada URL externa, usando pdf-proxy de Supabase...');
        // Para URLs externas, usar el pdf-proxy de Supabase
        const arrayBuffer = await this.downloadPdfArrayBuffer(pdfUrl);
        console.log('✅ [DEBUG] ArrayBuffer obtenido del proxy, tamaño:', arrayBuffer.byteLength, 'bytes');
        
        // Cargar PDF desde ArrayBuffer (evita CORS)
        loadingTask = window.pdfjsLib.getDocument({
          data: arrayBuffer,
          verbosity: 0
        });
      }
      
      this.pdfDocument = await loadingTask.promise;
      this.totalPages.set(this.pdfDocument.numPages);
      
      console.log(`✅ PDF cargado: ${this.totalPages()} páginas`);
      
      // Renderizar la primera página
      await this.renderPage(1);
      
      this.loading.set(false);
      
    } catch (error) {
      console.error('❌ Error cargando PDF:', error);
      this.error.set(`No se pudo cargar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      this.loading.set(false);
    }
  }
  
  private async renderPage(pageNumber: number) {
    if (!this.pdfDocument || pageNumber < 1 || pageNumber > this.totalPages()) {
      return;
    }
    
    try {
      // Limpiar página anterior
      if (this.currentPageObject) {
        this.currentPageObject.cleanup();
      }
      
      // Obtener la página
      this.currentPageObject = await this.pdfDocument.getPage(pageNumber);
      
      const canvas = this.canvasRef.nativeElement;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }
      
      // Calcular la escala para ajustar al contenedor
      const containerWidth = canvas.parentElement?.clientWidth || window.innerWidth - 32;
      const viewport = this.currentPageObject.getViewport({ scale: 1 });
      const baseScale = Math.min(containerWidth / viewport.width, 2); // Máximo 2x
      const finalScale = baseScale * this.scale();
      
      // Configurar el viewport con la escala final
      const scaledViewport = this.currentPageObject.getViewport({ scale: finalScale });
      
      // Configurar canvas para alta resolución
      const outputScale = window.devicePixelRatio || 1;
      
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = Math.floor(scaledViewport.width) + 'px';
      canvas.style.height = Math.floor(scaledViewport.height) + 'px';
      
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      
      // Renderizar la página
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        transform: transform
      };
      
      await this.currentPageObject.render(renderContext).promise;
      this.currentPage.set(pageNumber);
      
    } catch (error) {
      console.error('❌ Error renderizando página:', error);
      this.error.set(`Error renderizando la página ${pageNumber}`);
    }
  }
  
  // Navegación
  async previousPage() {
    if (this.currentPage() > 1) {
      await this.renderPage(this.currentPage() - 1);
    }
  }
  
  async nextPage() {
    if (this.currentPage() < this.totalPages()) {
      await this.renderPage(this.currentPage() + 1);
    }
  }
  
  // Zoom
  async zoomIn() {
    const newScale = Math.min(this.scale() * 1.2, 3);
    this.scale.set(newScale);
    await this.renderPage(this.currentPage());
  }
  
  async zoomOut() {
    const newScale = Math.max(this.scale() / 1.2, 0.5);
    this.scale.set(newScale);
    await this.renderPage(this.currentPage());
  }
  
  async retryLoad() {
    await this.initializePdfJs();
  }
  
  close() {
    this.closeRequested.emit();
  }
  
  /**
   * Imprime solo la primera página del PDF
   * Método directo sin cuadros de diálogo adicionales
   */
  async printFirstPage(): Promise<void> {
    if (!this.pdfDocument) {
      console.error('❌ No hay documento PDF cargado para imprimir');
      return;
    }
    
    try {
      console.log(`🖨️ Iniciando impresión directa de primera página`);
      
      // Obtener solo la primera página
      const page = await this.pdfDocument.getPage(1);
      
      // Configurar viewport para impresión optimizada
      const viewport = page.getViewport({ 
        scale: 2.0,
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

      // Renderizar la página en el canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Convertir canvas a imagen
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      // Imprimir directamente sin cuadros de diálogo
      this.openDirectPrintWindow(dataUrl, viewport.width, viewport.height);
      
    } catch (error) {
      console.error('❌ Error al imprimir primera página:', error);
    }
  }
  
  /**
   * Ventana de impresión directa y simplificada
   */
  private openDirectPrintWindow(imageDataUrl: string, width: number, height: number): void {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      console.error('No se pudo abrir la ventana de impresión');
      return;
    }

    // HTML simplificado para impresión directa
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
  
  private cleanup() {
    if (this.currentPageObject) {
      this.currentPageObject.cleanup();
    }
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
    }
  }
}
