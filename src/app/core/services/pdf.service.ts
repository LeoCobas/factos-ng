import { Injectable, inject } from '@angular/core';

import { FacturaPdfService } from './factura-pdf.service';
import { ContribuyenteService } from './contribuyente.service';
import { PdfJsPrintService } from './pdfjs-print.service';
import { PdfComprobanteData, PdfInfo } from '../types/pdf.types';

export interface PdfAsset<T extends PdfComprobanteData = PdfComprobanteData> {
  blob: Blob;
  blobUrl: string;
  info: PdfInfo<T>;
}

export interface PdfActionResult {
  success: boolean;
  message: string;
  type: 'success' | 'warning' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private readonly facturaPdfService = inject(FacturaPdfService);
  private readonly contribuyenteService = inject(ContribuyenteService);
  private readonly pdfJsPrintService = inject(PdfJsPrintService);

  private get capabilities() {
    return {
      webShare: 'share' in navigator,
      canShare: 'canShare' in navigator,
      fileSystemAccess: 'showSaveFilePicker' in window,
      clipboard: 'clipboard' in navigator && 'writeText' in navigator.clipboard,
      isAndroid: /Android/i.test(navigator.userAgent),
    };
  }

  async getPdfBlob<T extends PdfComprobanteData>(factura: T): Promise<Blob> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      throw new Error('Configuración de contribuyente no disponible');
    }

    return this.facturaPdfService.generarFacturaPdf(contribuyente, factura);
  }

  async createPdfAsset<T extends PdfComprobanteData>(factura: T): Promise<PdfAsset<T>> {
    const info = this.createPdfInfo(factura);
    const blob = await this.getPdfBlob(factura);
    const blobUrl = URL.createObjectURL(blob);

    return { blob, blobUrl, info };
  }

  revokeBlobUrl(blobUrl?: string | null): void {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }

  async sharePdf<T extends PdfComprobanteData>(pdfInfo: PdfInfo<T>): Promise<PdfActionResult> {
    const caps = this.capabilities;

    try {
      const pdfBlob = await this.getPdfBlob(pdfInfo.factura);
      const file = new File([pdfBlob], pdfInfo.filename, {
        type: 'application/pdf',
        lastModified: Date.now(),
      });

      if (caps.webShare && caps.canShare) {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: pdfInfo.title,
            text: pdfInfo.text,
            files: [file],
          });
          return this.createActionResult(true, 'Comprobante listo para compartir.');
        }

        await navigator.share({
          title: pdfInfo.title,
          text: pdfInfo.text,
        });
        return this.createActionResult(true, 'Comprobante listo para compartir.');
      }

      if (caps.isAndroid) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return this.createActionResult(true, 'PDF abierto en una pestaña nueva.');
      }

      return this.copyToClipboard(pdfInfo.text);
    } catch (error) {
      console.error('Error en sharePdf:', error);
      return this.copyToClipboard(
        pdfInfo.text,
        'No se pudo compartir el comprobante. Se copio la informacion al portapapeles.',
        'warning',
      );
    }
  }

  async downloadPdf<T extends PdfComprobanteData>(pdfInfo: PdfInfo<T>): Promise<PdfActionResult> {
    try {
      const pdfBlob = await this.getPdfBlob(pdfInfo.factura);

      if (this.capabilities.fileSystemAccess) {
        try {
          const fileHandle = await (
            window as Window & {
              showSaveFilePicker?: (options: unknown) => Promise<{
                createWritable: () => Promise<{
                  write: (blob: Blob) => Promise<void>;
                  close: () => Promise<void>;
                }>;
              }>;
            }
          ).showSaveFilePicker?.({
            suggestedName: pdfInfo.filename,
            types: [
              {
                description: 'PDF files',
                accept: { 'application/pdf': ['.pdf'] },
              },
            ],
          });

          if (fileHandle) {
            const writable = await fileHandle.createWritable();
            await writable.write(pdfBlob);
            await writable.close();

            return this.createActionResult(true, 'Ticket guardado exitosamente.');
          }
        } catch (fsError) {
          if (fsError instanceof Error && fsError.name === 'AbortError') {
            return this.createActionResult(false, 'Descarga cancelada.', 'warning');
          }
        }
      }

      this.downloadFallback(pdfBlob, pdfInfo.filename);
      return this.createActionResult(true, 'Descarga iniciada.');
    } catch (error) {
      console.error('Error descargando PDF:', error);
      return this.createActionResult(false, 'Error al generar el PDF del ticket.', 'error');
    }
  }

  async printFactura<T extends PdfComprobanteData>(factura: T): Promise<void> {
    const asset = await this.createPdfAsset(factura);

    try {
      await this.pdfJsPrintService.printPdfDirect({
        url: asset.blobUrl,
        filename: asset.info.filename,
        title: asset.info.title,
      });
    } finally {
      setTimeout(() => this.revokeBlobUrl(asset.blobUrl), 10000);
    }
  }

  createPdfInfo<T extends PdfComprobanteData>(factura: T): PdfInfo<T> {
    const tipoComprobante = this.getTipoComprobante(factura);
    const numeroSinCeros = this.getNumeroSinCeros(factura.numero_comprobante);
    const montoFormateado = this.formatearMonto(factura.total);

    return {
      factura,
      filename: `Ticket_${tipoComprobante.replace(' ', '')}_${numeroSinCeros}.pdf`,
      title: 'Ticket de venta emitido',
      text: `Ticket ${tipoComprobante} ${numeroSinCeros} - ${montoFormateado}`,
    };
  }

  private downloadFallback(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private createActionResult(
    success: boolean,
    message: string,
    type: PdfActionResult['type'] = success ? 'success' : 'error',
  ): PdfActionResult {
    return { success, message, type };
  }

  private async copyToClipboard(
    text: string,
    successMessage = 'Informacion de factura copiada al portapapeles.',
    successType: PdfActionResult['type'] = 'success',
  ): Promise<PdfActionResult> {
    if (this.capabilities.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return this.createActionResult(true, successMessage, successType);
      } catch (error) {
        console.warn('Error copiando al portapapeles:', error);
      }
    }

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
      return this.createActionResult(true, successMessage, successType);
    } catch {
      return this.createActionResult(
        false,
        `No se pudo copiar la informacion de la factura. ${text}`,
        'error',
      );
    } finally {
      document.body.removeChild(textarea);
    }
  }

  private getTipoComprobante(factura: PdfComprobanteData): string {
    if (factura.tipo_comprobante === 'FACTURA A') return 'FC A';
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO A') return 'NC A';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO B') return 'NC B';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO C') return 'NC C';
    return factura.tipo_comprobante || 'FC B';
  }

  private getNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1].replace(/^0+/, '') || '0';
    }

    return numeroCompleto?.replace(/^0+/, '') || '0';
  }

  private formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  }
}
