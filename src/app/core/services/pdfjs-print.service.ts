import { Injectable, inject } from '@angular/core';

import { PdfjsLoaderService, type PdfJsModule } from './pdfjs-loader.service';

export interface DirectPrintOptions {
  url: string;
  filename: string;
  title?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PdfJsPrintService {
  private readonly pdfjsLoader = inject(PdfjsLoaderService);
  private pdfjs: PdfJsModule | null = null;

  private async ensurePdfJsLoaded(): Promise<PdfJsModule> {
    if (!this.pdfjs) {
      this.pdfjs = await this.pdfjsLoader.load();
    }

    return this.pdfjs;
  }

  /**
   * Imprime la primera página del PDF generado localmente usando PDF.js cargado desde el bundle.
   * No depende de CDN y reutiliza el mismo worker local que el visor.
   */
  async printPdfDirect(options: DirectPrintOptions): Promise<void> {
    const pdfjs = await this.ensurePdfJsLoaded();
    const loadingTask = pdfjs.getDocument({
      url: options.url,
      verbosity: 0,
    });

    const pdfDocument = await loadingTask.promise;

    try {
      if (pdfDocument.numPages < 1) {
        throw new Error('El PDF no tiene paginas para imprimir');
      }

      const page = await pdfDocument.getPage(1);
      const { imageDataUrl, width, height } = await this.renderPageToCanvas(page);
      this.openDirectPrintWindow(imageDataUrl, width, height);
    } finally {
      pdfDocument.destroy();
    }
  }

  private async renderPageToCanvas(
    page: any,
  ): Promise<{ imageDataUrl: string; width: number; height: number }> {
    const viewport = page.getViewport({
      scale: 2.0,
      rotation: 0,
    });

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

    return {
      imageDataUrl: canvas.toDataURL('image/png', 1.0),
      width: viewport.width,
      height: viewport.height,
    };
  }

  private openDirectPrintWindow(imageDataUrl: string, width: number, _height: number): void {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      throw new Error('No se pudo abrir la ventana de impresion');
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
}
