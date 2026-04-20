declare module 'pdfjs-dist/build/pdf.min.mjs' {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(params: {
    url?: string;
    data?: Uint8Array | ArrayBuffer;
    disableAutoFetch?: boolean;
    disableStream?: boolean;
    verbosity?: number;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getViewport(params: { scale: number; rotation?: number }): {
          width: number;
          height: number;
        };
        render(renderContext: {
          canvasContext: CanvasRenderingContext2D;
          viewport: unknown;
          transform?: number[] | null;
        }): {
          promise: Promise<void>;
        };
        cleanup(): void;
      }>;
      destroy(): void;
    }>;
  };
}
