import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Comprobante } from '../../core/types/database.types';
import { FacturaEmitidaPanelComponent } from './factura-emitida-panel.component';

function crearComprobante(overrides: Partial<Comprobante> = {}): Comprobante {
  return {
    id: 'factura-1',
    contribuyente_id: 'contribuyente-1',
    tipo_comprobante: 'FACTURA C',
    numero_comprobante: '0001-00000010',
    punto_venta: 1,
    fecha: '2026-04-24',
    total: 1010,
    cae: null,
    vencimiento_cae: null,
    estado: 'emitida',
    concepto: null,
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
    ...overrides,
  };
}

describe('FacturaEmitidaPanelComponent', () => {
  let fixture: ComponentFixture<FacturaEmitidaPanelComponent>;
  let component: FacturaEmitidaPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturaEmitidaPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FacturaEmitidaPanelComponent);
    component = fixture.componentInstance;
    component.factura = crearComprobante();
    component.tipoComprobante = 'FC C';
    component.numeroComprobante = '00000010';
    component.monto = '$ 1.010,00';
  });

  it('muestra las acciones directamente en la factura emitida', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Factura emitida');
    expect(compiled.textContent).toContain('Ver');
    expect(compiled.textContent).toContain('Compartir');
    expect(compiled.textContent).toContain('Descargar');
    expect(compiled.textContent).toContain('Imprimir');
    expect(compiled.textContent).toContain('Cerrar');
    expect(compiled.textContent).not.toContain('Volver');
    expect(compiled.textContent).not.toContain('Ver acciones');
    expect(compiled.textContent).not.toContain('Ocultar acciones');
  });
});
