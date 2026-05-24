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

  it('emite el evento ver al seleccionar la accion de ver', () => {
    const spy = vi.spyOn(component.ver, 'emit');
    component.onAction('ver');
    expect(spy).toHaveBeenCalled();
  });

  it('emite el evento compartir al seleccionar la accion de compartir', () => {
    const spy = vi.spyOn(component.compartir, 'emit');
    component.onAction('compartir');
    expect(spy).toHaveBeenCalled();
  });

  it('emite el evento descargar al seleccionar la accion de descargar', () => {
    const spy = vi.spyOn(component.descargar, 'emit');
    component.onAction('descargar');
    expect(spy).toHaveBeenCalled();
  });

  it('emite el evento imprimir al seleccionar la accion de imprimir', () => {
    const spy = vi.spyOn(component.imprimir, 'emit');
    component.onAction('imprimir');
    expect(spy).toHaveBeenCalled();
  });

  it('emite el evento volver al solicitar cerrar el panel', () => {
    fixture.detectChanges();
    const spy = vi.spyOn(component.volver, 'emit');
    const compiled = fixture.nativeElement as HTMLElement;
    const closeButton = compiled.querySelector('.receipt-result-panel__close') as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    closeButton?.click();
    expect(spy).toHaveBeenCalled();
  });
});
