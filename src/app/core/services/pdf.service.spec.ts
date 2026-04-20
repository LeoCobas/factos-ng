import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ContribuyenteService } from './contribuyente.service';
import { FacturaPdfService } from './factura-pdf.service';
import { PdfJsPrintService } from './pdfjs-print.service';
import { PdfService } from './pdf.service';

describe('PdfService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PdfService,
        {
          provide: FacturaPdfService,
          useValue: {
            generarFacturaPdf: vi.fn(),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: {
            contribuyente: signal({
              id: 'cont-1',
              cuit: '20123456789',
            }),
          },
        },
        {
          provide: PdfJsPrintService,
          useValue: {
            printPdfDirect: vi.fn(),
          },
        },
      ],
    });
  });

  it('arma filename, titulo y texto desde el contrato tipado', () => {
    const service = TestBed.inject(PdfService);

    const info = service.createPdfInfo({
      tipo_comprobante: 'NOTA DE CREDITO C',
      numero_comprobante: '0001-00000008',
      fecha: '2026-04-20',
      total: 2500,
    });

    expect(info.filename).toBe('Ticket_NCC_8.pdf');
    expect(info.title).toBe('Ticket de venta emitido');
    expect(info.text).toContain('NC C 8');
  });
});
