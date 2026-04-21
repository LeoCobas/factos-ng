import {
  getTipoComprobanteDefaultFromCondicionIva,
  normalizeCondicionIva,
  resolveTipoComprobanteDetallado,
} from './factura-cliente.util';
import { extractFiscalDataFromConstancia } from './constancia-inscripcion.util';

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

  describe('getTipoComprobanteDefaultFromCondicionIva', () => {
    it('deriva factura B para responsables inscriptos', () => {
      expect(getTipoComprobanteDefaultFromCondicionIva('IVA Responsable Inscripto')).toBe(
        'FACTURA B',
      );
    });

    it('deriva factura C para monotributo y casos no clasificados', () => {
      expect(getTipoComprobanteDefaultFromCondicionIva('Responsable Monotributo')).toBe(
        'FACTURA C',
      );
      expect(getTipoComprobanteDefaultFromCondicionIva(null)).toBe('FACTURA C');
    });
  });

  describe('extractFiscalDataFromConstancia', () => {
    it('detecta responsable inscripto cuando la constancia resumida solo trae id de impuesto IVA', () => {
      expect(
        extractFiscalDataFromConstancia({
          datosRegimenGeneral: {
            impuestos: [11, 30],
          },
        }),
      ).toEqual({
        condicionIva: 'IVA Responsable Inscripto',
        fiscalProfile: 'responsable-inscripto',
        reliable: true,
        message: 'Condicion fiscal verificada por constancia de inscripcion.',
      });
    });

    it('detecta monotributo cuando la constancia resumida trae categoria y el impuesto 20', () => {
      expect(
        extractFiscalDataFromConstancia({
          datosMonotributo: {
            categoria: 'A',
            impuestos: [20],
          },
        }),
      ).toEqual({
        condicionIva: 'Responsable Monotributo',
        fiscalProfile: 'monotributo',
        reliable: true,
        message: 'Condicion fiscal verificada por constancia de inscripcion.',
      });
    });
  });
});
