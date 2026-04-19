import {
  normalizeCondicionIva,
  resolveTipoComprobanteDetallado,
} from './factura-cliente.util';

describe('factura-cliente.util', () => {
  describe('normalizeCondicionIva', () => {
    it('normaliza estados fiscales explicitos de constancia', () => {
      expect(normalizeCondicionIva('IVA Responsable Inscripto')).toBe(
        'IVA Responsable Inscripto',
      );
      expect(normalizeCondicionIva('Responsable Monotributo')).toBe(
        'Responsable Monotributo',
      );
      expect(normalizeCondicionIva('No Inscripto')).toBe('No Inscripto');
      expect(normalizeCondicionIva('Activo no alcanzado')).toBe('No Alcanzado');
    });
  });

  describe('resolveTipoComprobanteDetallado', () => {
    it('emite factura A solo con cliente RI confirmado', () => {
      expect(
        resolveTipoComprobanteDetallado(
          'IVA Responsable Inscripto',
          'IVA Responsable Inscripto',
          'FACTURA B',
          'responsable-inscripto',
        ),
      ).toEqual({
        tipo: 'FACTURA A',
        modo: 'automatico',
        requiereRevision: false,
        motivo: 'La constancia indica IVA activo para el cliente.',
      });
    });

    it('emite factura B para monotributo confirmado', () => {
      expect(
        resolveTipoComprobanteDetallado(
          'IVA Responsable Inscripto',
          'Responsable Monotributo',
          'FACTURA B',
          'monotributo',
        ),
      ).toEqual({
        tipo: 'FACTURA B',
        modo: 'automatico',
        requiereRevision: false,
        motivo: 'La condicion fiscal del cliente no habilita Factura A.',
      });
    });

    it('no escala a factura A cuando la constancia es ambigua', () => {
      expect(
        resolveTipoComprobanteDetallado(
          'IVA Responsable Inscripto',
          'No categorizado',
          'FACTURA B',
          'ambiguo',
        ),
      ).toEqual({
        tipo: 'FACTURA B',
        modo: 'fallback',
        requiereRevision: true,
        motivo: 'La constancia no aporta datos fiscales suficientes para habilitar Factura A.',
      });
    });

    it('mantiene factura C para emisores monotributistas', () => {
      expect(
        resolveTipoComprobanteDetallado(
          'Responsable Monotributo',
          'IVA Responsable Inscripto',
          'FACTURA B',
          'responsable-inscripto',
        ),
      ).toEqual({
        tipo: 'FACTURA C',
        modo: 'automatico',
        requiereRevision: false,
        motivo: 'El emisor no factura A/B segun su condicion frente al IVA.',
      });
    });
  });
});
