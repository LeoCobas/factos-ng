// PDF.js tipos básicos para uso global
declare global {
  interface Window {
    pdfjsLib: {
      getDocument(params: { url?: string; data?: Uint8Array; disableAutoFetch?: boolean; disableStream?: boolean }): {
        promise: Promise<{
          numPages: number;
          getPage(pageNumber: number): Promise<{
            getViewport(params: { scale: number }): {
              width: number;
              height: number;
            };
            render(renderContext: {
              canvasContext: CanvasRenderingContext2D;
              viewport: any;
              transform?: number[] | null;
            }): {
              promise: Promise<void>;
            };
            cleanup(): void;
          }>;
          destroy(): void;
        }>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}
