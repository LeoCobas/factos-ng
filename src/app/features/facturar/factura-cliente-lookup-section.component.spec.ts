import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

import { FacturaClienteLookupSectionComponent } from './factura-cliente-lookup-section.component';

describe('FacturaClienteLookupSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturaClienteLookupSectionComponent],
    }).compileComponents();
  });

  it('renderiza mensajes de warning y el cliente seleccionado', () => {
    const fixture = TestBed.createComponent(FacturaClienteLookupSectionComponent);
    fixture.componentRef.setInput('clienteCuitControl', new FormControl('20123456789', { nonNullable: true }));
    fixture.componentRef.setInput('clienteCuitValido', true);
    fixture.componentRef.setInput('buscandoCliente', false);
    fixture.componentRef.setInput('clienteSeleccionado', {
      cuit: '20123456789',
      nombre: 'Cliente Demo',
      domicilio: null,
      condicion_iva: 'Consumidor Final',
      condicion_iva_normalizada: 'Consumidor Final',
      doc_tipo: 80,
      doc_nro: 20123456789,
      fiscal_profile: 'sin-datos',
      fiscal_status_message: 'Revisar condición',
      fiscal_status_reliable: false,
      fiscal_status_source: 'constancia_inscripcion',
    });
    fixture.componentRef.setInput('clienteCuitFormateado', '20-12345678-9');
    fixture.componentRef.setInput('condicionClienteLabel', 'Consumidor Final');
    fixture.componentRef.setInput('tipoComprobanteResueltoLabel', 'FC C');
    fixture.componentRef.setInput('requiereRevision', true);
    fixture.componentRef.setInput('mostrarAlertaCliente', true);
    fixture.componentRef.setInput('alertaClienteTexto', 'Revisar condición');
    fixture.componentRef.setInput('mensajeClienteTipo', 'warning');

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Cliente Demo');
    expect(text).toContain('Revisar condición');
    expect(text).toContain('FC C');
  });
});
