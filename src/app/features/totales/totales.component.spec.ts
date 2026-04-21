import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { TotalesComponent } from './totales.component';

describe('TotalesComponent', () => {
  beforeEach(async () => {
    registerLocaleData(localeEsAr);

    await TestBed.configureTestingModule({
      imports: [TotalesComponent],
      providers: [
        {
          provide: ComprobantesService,
          useValue: {
            cargarMetricasComprobantes: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: {
            contribuyente: signal({ id: 'cont-1' }),
          },
        },
      ],
    }).compileComponents();
  });

  it('muestra un mensaje visible cuando falla la carga de totales por conexion', async () => {
    const fixture = TestBed.createComponent(TotalesComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No se pudieron cargar los totales porque no hay conexion a internet.',
    );
  });
});
