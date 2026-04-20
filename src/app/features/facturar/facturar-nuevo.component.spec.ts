import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ContribuyenteService } from '../../core/services/contribuyente.service';
import {
  FacturacionService,
  FacturaReciente,
} from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { FacturarNuevoComponent } from './facturar-nuevo.component';

describe('FacturarNuevoComponent', () => {
  const createFacturacionServiceStub = () => ({
    emitirFactura: vi.fn().mockResolvedValue({
      success: true,
      comprobante: {
        id: 'comp-1',
        contribuyente_id: 'cont-1',
        tipo_comprobante: 'FACTURA C',
        numero_comprobante: '0001-00000015',
        punto_venta: 1,
        fecha: '2026-04-20',
        total: 12000,
        cae: '123',
        vencimiento_cae: '20260430',
        estado: 'emitida',
        concepto: 'Servicios',
        pdf_url: null,
        afip_id: null,
        cliente_cuit: null,
        cliente_doc_tipo: null,
        cliente_doc_nro: null,
        cliente_nombre: null,
        cliente_domicilio: null,
        cliente_condicion_iva: null,
        comprobante_asociado_id: null,
        created_at: null,
        updated_at: null,
      },
    }),
    buscarClientePorCuit: vi.fn(),
    cargarFacturasRecientes: vi.fn().mockResolvedValue([
      {
        id: 'fac-1',
        fecha: '2026-04-20',
        tipo_comprobante: 'FACTURA C',
        total: 12000,
        numero_comprobante: '0001-00000014',
        created_at: null,
      } satisfies FacturaReciente,
    ]),
  });

  beforeEach(async () => {
    registerLocaleData(localeEsAr);

    await TestBed.configureTestingModule({
      imports: [FacturarNuevoComponent],
      providers: [
        {
          provide: FacturacionService,
          useValue: createFacturacionServiceStub(),
        },
        {
          provide: PdfService,
          useValue: {
            createPdfAsset: vi.fn(),
            revokeBlobUrl: vi.fn(),
            createPdfInfo: vi.fn(),
            sharePdf: vi.fn(),
            printFactura: vi.fn(),
            downloadPdf: vi.fn(),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: {
            contribuyente: signal({
              id: 'cont-1',
              actividad: 'servicios',
              condicion_iva: 'Monotributo',
              tipo_comprobante_default: 'FACTURA C',
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renderiza el panel de facturas recientes y recarga al tener contribuyente', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.cargarFacturasRecientes).toHaveBeenCalledWith('cont-1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Últimas facturas');
  });

  it('envia el submit valido y resetea el formulario en exito', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    component.formFactura.setValue({
      monto: 12000,
      fecha: '2026-04-20',
      cliente_cuit: '',
    });

    await component.emitirFactura();

    expect(service.emitirFactura).toHaveBeenCalled();
    expect(component.facturaEmitida()?.numero_comprobante).toBe('0001-00000015');
    expect(component.formFactura.controls.monto.value).toBe('');
  });
});
