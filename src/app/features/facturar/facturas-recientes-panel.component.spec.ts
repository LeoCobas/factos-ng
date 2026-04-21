import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { TestBed } from '@angular/core/testing';

import { FacturasRecientesPanelComponent } from './facturas-recientes-panel.component';

describe('FacturasRecientesPanelComponent', () => {
  beforeEach(async () => {
    registerLocaleData(localeEsAr);

    await TestBed.configureTestingModule({
      imports: [FacturasRecientesPanelComponent],
    }).compileComponents();
  });

  it('muestra el estado vacio cuando no hay facturas', () => {
    const fixture = TestBed.createComponent(FacturasRecientesPanelComponent);
    fixture.componentRef.setInput('facturas', []);
    fixture.componentRef.setInput('cargando', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Todavía no hay facturas recientes.',
    );
  });

  it('renderiza la lista de facturas recientes', () => {
    const fixture = TestBed.createComponent(FacturasRecientesPanelComponent);
    fixture.componentRef.setInput('facturas', [
      {
        id: 'fac-1',
        tipoLabel: 'FC C',
        numeroLabel: '12',
        fechaLabel: '20/04/2026',
        total: 1500,
      },
    ]);
    fixture.componentRef.setInput('cargando', false);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('FC C 12');
    expect(text).toContain('20/04/2026');
    expect(text).toContain('$');
    expect(text).toContain('1.500');
  });
});
