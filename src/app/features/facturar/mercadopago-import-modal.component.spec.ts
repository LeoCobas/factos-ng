import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MercadopagoService } from '../../core/services/mercadopago.service';
import { UiService } from '../../core/services/ui.service';
import type { MpPayment } from '../../core/types/mercadopago.types';
import { MercadopagoImportModalComponent } from './mercadopago-import-modal.component';

describe('MercadopagoImportModalComponent', () => {
  beforeEach(async () => {
    registerLocaleData(localeEsAr);

    await TestBed.configureTestingModule({
      imports: [MercadopagoImportModalComponent],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-AR' },
        {
          provide: MercadopagoService,
          useValue: {
            hasMpToken: () => true,
            getDefaultBeginDate: vi.fn(),
            getDefaultEndDate: vi.fn(),
          },
        },
        {
          provide: UiService,
          useValue: {
            abrirConfiguracion: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('muestra Desde y Hasta a la izquierda de sus selectores de fecha', () => {
    const fixture = TestBed.createComponent(MercadopagoImportModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const dateFields = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.date-range-field'),
    );

    expect(dateFields).toHaveLength(2);
    expect(dateFields.map((field) => field.querySelector('label')?.textContent?.trim())).toEqual([
      'Desde',
      'Hasta',
    ]);
    expect(dateFields.every((field) => field.classList.contains('flex'))).toBe(true);
    expect(dateFields.every((field) => field.querySelector('input[type="datetime-local"]'))).toBe(true);
  });

  it('muestra el encabezado y el resumen de selección con el texto solicitado', () => {
    const fixture = TestBed.createComponent(MercadopagoImportModalComponent);
    const component = fixture.componentInstance;
    const payment: MpPayment = {
      id: 'payment-1',
      date_created: '2026-07-29T12:00:00Z',
      transaction_amount: 6350835.01,
      description: 'Bank Transfer',
      payer: { first_name: null, last_name: null },
    };

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    component.payments.set([payment]);
    component.selectedIds.set(new Set([payment.id]));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const title = host.querySelector('h3');
    const summary = host.querySelector('.selection-summary');
    const tableHead = host.querySelector('thead');

    expect(title?.textContent?.trim()).toBe('Importar desde Mercado Pago');
    expect(title?.classList.contains('text-[17px]')).toBe(true);
    expect(host.textContent).toContain('Seleccione el rango de fechas.');
    expect(host.textContent).toContain('Concepto');
    expect(host.textContent).not.toContain('Concepto / Descripción');
    expect(summary?.textContent).toContain('1 cobros seleccionados');
    expect(summary?.textContent).toContain('Total $ 6.350.835,01');
    expect(summary?.querySelectorAll(':scope > span')).toHaveLength(2);
    expect(host.textContent).toContain('Encontrados 1 cobros');
    expect(host.textContent).toContain('Borrar Selección');
    expect(host.textContent).toContain('Facturar Lote');
    expect(host.textContent).not.toContain('Mostrando 1 cobros encontrados');
    expect(host.textContent).not.toContain('Deseleccionar todos');
    expect(host.textContent).not.toContain('Procesar Lote');
    expect(tableHead?.classList.contains('z-10')).toBe(true);
    expect(tableHead?.classList.contains('bg-muted')).toBe(true);
    expect(tableHead?.classList.contains('backdrop-blur-sm')).toBe(false);
  });

  it('destaca montos mayores o iguales a $ 100.000 con clase de color ámbar', () => {
    const fixture = TestBed.createComponent(MercadopagoImportModalComponent);
    const component = fixture.componentInstance;
    const paymentHigh: MpPayment = {
      id: 'p-high',
      date_created: '2026-07-29T12:00:00Z',
      transaction_amount: 150000,
      description: 'Pago grande',
      payer: { first_name: null, last_name: null },
    };
    const paymentNormal: MpPayment = {
      id: 'p-normal',
      date_created: '2026-07-29T12:00:00Z',
      transaction_amount: 50000,
      description: 'Pago comun',
      payer: { first_name: null, last_name: null },
    };

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    component.payments.set([paymentHigh, paymentNormal]);
    fixture.detectChanges();

    const amountCells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody td:last-child'),
    );

    expect(amountCells[0].classList.contains('text-amber-700')).toBe(true);
    expect(amountCells[0].classList.contains('dark:text-amber-400')).toBe(true);
    expect(amountCells[1].classList.contains('text-amber-700')).toBe(false);
  });

  it('formatea las fechas de forma compacta en 24h (DD/MM/YY, HH:mm)', () => {
    const fixture = TestBed.createComponent(MercadopagoImportModalComponent);
    const component = fixture.componentInstance;
    const formatted = component.formatDateTime('2026-07-20T13:06:00');
    expect(formatted).toBe('20/07/26, 13:06');
  });
});
