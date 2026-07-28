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
   * Convierte URLs tipo blob: a data:application/pdf;base64,... para evitar
   * los bloqueos de seguridad de Chromium en iframe al hacer print() silencioso.
   */
  private async resolveToDataUrl(url: string): Promise<string> {
    if (!url || url.startsWith('data:')) {
      return url;
    }

    if (url.startsWith('blob:')) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('Error convirtiendo blob a dataUrl:', err);
        return url;
      }
    }

    return url;
  }

  /**
   * Imprime el PDF utilizando el motor vectorial nativo del navegador (PDFium en Chrome/Edge)
   * mediante un iframe invisible. Esto evita convertir la pagina a imagen PNG y
   * previene cualquier tipo de borrosidad o rasterizado ("efecto masticado") en la impresora termica.
   */
  async printPdfVector(url: string): Promise<boolean> {
    const dataUrl = await this.resolveToDataUrl(url);

    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '-9999px';
      iframe.style.bottom = '-9999px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';

      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          // Retener el iframe 60s en el DOM para asegurar que el spooler de Windows termine de enviar los vectores nativos a la impresora termica sin abortar el trabajo
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 60000);
        }
      };

      iframe.onload = () => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            cleanup();
            resolve(true);
            return;
          }
        } catch (err) {
          console.warn('Fallback a impresion direct window:', err);
        }
        cleanup();
        resolve(false);
      };

      iframe.onerror = () => {
        cleanup();
        resolve(false);
      };

      iframe.src = dataUrl;
      document.body.appendChild(iframe);
    });
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
      scale: 3.0,
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

  private openDirectPrintWindow(imageDataUrl: string, _width: number, _height: number): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Imprimir Factura</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            background: white;
          }
          .print-container {
            width: 100%;
            margin: 0 auto;
            text-align: center;
          }
          .print-image {
            width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            .print-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .print-image {
              width: 100% !important;
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
      </body>
      </html>
    `;

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('Error imprimiendo iframe:', err);
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 60000);
      }, 300);
    }
  }
}
