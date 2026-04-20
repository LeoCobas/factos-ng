import { Injectable } from '@angular/core';

export type PdfJsModule = typeof import('pdfjs-dist/build/pdf.min.mjs');

const PDFJS_WORKER_SRC = '/assets/pdfjs/pdf.worker.min.mjs';

@Injectable({
  providedIn: 'root',
})
export class PdfjsLoaderService {
  private modulePromise: Promise<PdfJsModule> | null = null;

  /**
   * Carga PDF.js desde una dependencia local del bundle y fija un worker local.
   * El contrato compartido evita fallback a CDN en visor e impresion.
   */
  load(): Promise<PdfJsModule> {
    if (!this.modulePromise) {
      this.modulePromise = import('pdfjs-dist/build/pdf.min.mjs').then((module) => {
        module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        return module;
      });
    }

    return this.modulePromise;
  }
}
