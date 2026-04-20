import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  input,
  output,
  signal,
  inject,
} from '@angular/core';

import { PdfjsLoaderService, type PdfJsModule } from '../../../core/services/pdfjs-loader.service';

export interface PdfViewerConfig {
  url: string;
  title: string;
  filename: string;
}

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [],
  template: `
    <div class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      <div
        class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
      >
        <div class="flex-1 min-w-0 w-full sm:w-auto">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {{ config().title }}
          </h3>
        </div>

        <div class="flex items-center gap-1 sm:gap-2 flex-wrap w-full sm:w-auto justify-end">
          <button
            type="button"
            (click)="zoomOut()"
            [disabled]="scale() <= 0.5"
            class="p-1.5 sm:p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Alejar"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
            </svg>
          </button>

          <span
            class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 min-w-8 sm:min-w-12 text-center px-1"
          >
            {{ Math.round(scale() * 100) }}%
          </span>

          <button
            type="button"
            (click)="zoomIn()"
            [disabled]="scale() >= 3"
            class="p-1.5 sm:p-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Acercar"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
          </button>

          <button
            type="button"
            (click)="printFirstPage()"
            class="p-1.5 sm:p-2 rounded bg-orange-500 hover:bg-orange-600 text-white"
            title="Imprimir primera página"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              ></path>
            </svg>
          </button>

          <button
            type="button"
            (click)="close()"
            class="p-1.5 sm:p-2 rounded bg-red-500 hover:bg-red-600 text-white"
            title="Cerrar"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto relative">
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center p-4">
              <div
                class="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mb-2 sm:mb-4"
              ></div>
              <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">Cargando PDF...</p>
            </div>
          </div>
        }

        @if (error()) {
          <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="text-center max-w-md mx-auto p-4 sm:p-6">
              <div class="text-red-500 mb-2 sm:mb-4">
                <svg class="w-8 h-8 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <h4 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Error al cargar PDF
              </h4>
              <p class="text-gray-600 dark:text-gray-400 mb-4 text-xs sm:text-sm">{{ error() }}</p>
              <button
                type="button"
                (click)="retryLoad()"
                class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded transition-colors text-sm sm:text-base"
              >
                Reintentar
              </button>
            </div>
          </div>
        }

        <div class="flex justify-center p-2 sm:p-4">
          <canvas
            #pdfCanvas
            [style.display]="loading() || error() ? 'none' : 'block'"
            class="max-w-full shadow-lg border border-gray-200 dark:border-gray-700"
          ></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      canvas {
        max-width: 100%;
        height: auto;
      }

      @media (max-width: 640px) {
        .print-container {
          padding: 8px !important;
        }

        button {
          min-height: 44px;
          min-width: 44px;
        }

        .text-container {
          font-size: 14px !important;
          line-height: 1.4;
        }
      }
    `,
  ],
})
export class PdfViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pdfCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly pdfjsLoader = inject(PdfjsLoaderService);

  config = input.required<PdfViewerConfig>();
  closeRequested = output<void>();

  loading = signal(true);
  error = signal<string | null>(null);
  currentPage = signal(1);
  totalPages = signal(0);
  scale = signal(1);

  Math = Math;

  private pdfjs: PdfJsModule | null = null;
  private pdfDocument: any = null;
  private currentPageObject: any = null;

  ngAfterViewInit(): void {
    void this.initializePdfJs();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private async initializePdfJs(): Promise<void> {
    try {
      this.pdfjs = await this.pdfjsLoader.load();
      await this.loadPdf();
    } catch (error) {
      this.error.set(
        `Error cargando PDF.js: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
      this.loading.set(false);
    }
  }

  private async loadPdf(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      if (!this.pdfjs) {
        throw new Error('PDF.js no está inicializado');
      }

      const loadingTask = this.pdfjs.getDocument({
        url: this.config().url,
        verbosity: 0,
      });

      this.pdfDocument = await loadingTask.promise;
      this.totalPages.set(this.pdfDocument.numPages);
      await this.renderPage(1);
      this.loading.set(false);
    } catch (error) {
      this.error.set(
        `No se pudo cargar el PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
      this.loading.set(false);
    }
  }

  private async renderPage(pageNumber: number): Promise<void> {
    if (!this.pdfDocument || pageNumber < 1 || pageNumber > this.totalPages()) {
      return;
    }

    try {
      if (this.currentPageObject) {
        this.currentPageObject.cleanup();
      }

      this.currentPageObject = await this.pdfDocument.getPage(pageNumber);

      const canvas = this.canvasRef.nativeElement;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }

      const containerWidth = canvas.parentElement?.clientWidth || window.innerWidth - 32;
      const viewport = this.currentPageObject.getViewport({ scale: 1 });
      const baseScale = Math.min(containerWidth / viewport.width, 2);
      const finalScale = baseScale * this.scale();
      const scaledViewport = this.currentPageObject.getViewport({ scale: finalScale });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
      canvas.style.height = `${Math.floor(scaledViewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      await this.currentPageObject.render({
        canvasContext: context,
        viewport: scaledViewport,
        transform,
      }).promise;

      this.currentPage.set(pageNumber);
    } catch {
      this.error.set(`Error renderizando la página ${pageNumber}`);
    }
  }

  async previousPage(): Promise<void> {
    if (this.currentPage() > 1) {
      await this.renderPage(this.currentPage() - 1);
    }
  }

  async nextPage(): Promise<void> {
    if (this.currentPage() < this.totalPages()) {
      await this.renderPage(this.currentPage() + 1);
    }
  }

  async zoomIn(): Promise<void> {
    this.scale.set(Math.min(this.scale() * 1.2, 3));
    await this.renderPage(this.currentPage());
  }

  async zoomOut(): Promise<void> {
    this.scale.set(Math.max(this.scale() / 1.2, 0.5));
    await this.renderPage(this.currentPage());
  }

  async retryLoad(): Promise<void> {
    await this.initializePdfJs();
  }

  close(): void {
    this.closeRequested.emit();
  }

  async printFirstPage(): Promise<void> {
    if (!this.pdfDocument) {
      return;
    }

    try {
      const page = await this.pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 2.0, rotation: 0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      this.openDirectPrintWindow(canvas.toDataURL('image/png', 1.0), viewport.width, viewport.height);
    } catch {
      this.error.set('No se pudo preparar la impresión del PDF.');
    }
  }

  private openDirectPrintWindow(imageDataUrl: string, width: number, _height: number): void {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      this.error.set('No se pudo abrir la ventana de impresión.');
      return;
    }

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

  private cleanup(): void {
    if (this.currentPageObject) {
      this.currentPageObject.cleanup();
    }

    if (this.pdfDocument) {
      this.pdfDocument.destroy();
    }

    this.pdfjs = null;
  }
}
