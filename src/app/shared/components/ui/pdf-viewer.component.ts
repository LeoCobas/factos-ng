import { Component, input, signal, AfterViewInit, ViewChild, ElementRef, OnDestroy, output } from '@angular/core';
import { CommonModule } from '@angular/common';

// Declaraciones globales para PDF.js v5.4.54
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface PdfViewerConfig {
  url: string;           // Blob URL del PDF
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
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {{ config().title }}
          </h3>
          @if (totalPages() > 0) {
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Página {{ currentPage() }} de {{ totalPages() }}
            </p>
          }
        </div>
        
        <!-- Controles de navegación -->
        <div class="flex items-center gap-2">
          @if (totalPages() > 1) {
            <button 
              (click)="previousPage()"
              [disabled]="currentPage() <= 1"
              class="p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Página anterior">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            
            <button 
              (click)="nextPage()"
              [disabled]="currentPage() >= totalPages()"
              class="p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Página siguiente">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          }
          
          <!-- Controles de zoom -->
          <button 
            (click)="zoomOut()"
            [disabled]="scale() <= 0.5"
            class="p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Alejar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
            </svg>
          </button>
          
          <span class="text-sm text-gray-600 dark:text-gray-400 min-w-12 text-center">
            {{ Math.round(scale() * 100) }}%
          </span>
          
          <button 
            (click)="zoomIn()"
            [disabled]="scale() >= 3"
            class="p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Acercar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
          </button>
          
          <!-- Botón cerrar -->
          <button 
            (click)="close()"
            class="p-2 rounded bg-red-500 hover:bg-red-600 text-white ml-2"
            title="Cerrar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Área del PDF -->
      <div class="flex-1 overflow-auto relative">
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p class="text-gray-600 dark:text-gray-400">Cargando PDF...</p>
            </div>
          </div>
        }
        
        @if (error()) {
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center max-w-md mx-auto p-6">
              <div class="text-red-500 mb-4">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Error al cargar PDF</h4>
              <p class="text-gray-600 dark:text-gray-400 mb-4 text-sm">{{ error() }}</p>
              <button 
                (click)="retryLoad()"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors">
                Reintentar
              </button>
            </div>
          </div>
        }
        
        <!-- Canvas para renderizar PDF -->
        <div class="flex justify-center p-4">
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
  
  private async loadPdf() {
    try {
      this.loading.set(true);
      this.error.set(null);
      
      const pdfUrl = this.config().url;
      console.log('📄 Cargando PDF:', pdfUrl);
      
      // Cargar el PDF usando la blob URL
      const loadingTask = window.pdfjsLib.getDocument({
        url: pdfUrl,
        disableAutoFetch: false,
        disableStream: false
      });
      
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
  
  private cleanup() {
    if (this.currentPageObject) {
      this.currentPageObject.cleanup();
    }
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
    }
  }
}
