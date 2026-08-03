import { TestBed } from '@angular/core/testing';

import { ArcaReconciliationService } from '../../core/services/arca-reconciliation.service';
import { ConfiguracionReconciliacionComponent } from './configuracion-reconciliacion.component';

describe('ConfiguracionReconciliacionComponent', () => {
  const service = {
    auditar: vi.fn(),
    reconciliar: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ConfiguracionReconciliacionComponent],
      providers: [{ provide: ArcaReconciliationService, useValue: service }],
    }).compileComponents();
  });

  it('audita los ultimos 100 comprobantes y expone el resumen', async () => {
    service.auditar.mockResolvedValue({
      first: 1,
      last: 66,
      summary: { existing: 64, imported: 2 },
      results: [
        { cbte_nro: 65, status: 'imported' },
        { cbte_nro: 66, status: 'imported' },
      ],
    });
    const fixture = TestBed.createComponent(ConfiguracionReconciliacionComponent);
    const component = fixture.componentInstance;
    component.puntoVenta.set(4);
    component.tipoComprobante.set('FACTURA C');

    await component.auditar();

    expect(service.auditar).toHaveBeenCalledWith(4, 'FACTURA C');
    expect(component.summary()).toEqual({ existing: 64, imported: 2 });
    expect(component.results()).toHaveLength(2);
  });

  it('reconcilia un numero individual', async () => {
    service.reconciliar.mockResolvedValue({ status: 'reconciled', comprobante: { id: 'cmp-1' } });
    const fixture = TestBed.createComponent(ConfiguracionReconciliacionComponent);
    const component = fixture.componentInstance;
    component.puntoVenta.set(4);
    component.cbteNro.set(66);

    await component.reconciliar();

    expect(service.reconciliar).toHaveBeenCalledWith(4, 'FACTURA C', 66);
    expect(component.results()[0]).toEqual(expect.objectContaining({ cbte_nro: 66, status: 'reconciled' }));
  });
});
