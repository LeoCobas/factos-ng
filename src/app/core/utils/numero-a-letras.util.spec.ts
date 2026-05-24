import { numeroALetras, importeEnLetras } from './numero-a-letras.util';

describe('numero-a-letras util', () => {
  describe('numeroALetras', () => {
    it('debe convertir cero correctamente', () => {
      expect(numeroALetras(0)).toBe('CERO CON 00/100');
    });

    it('debe convertir unidades basicas', () => {
      expect(numeroALetras(1)).toBe('UN CON 00/100');
      expect(numeroALetras(5)).toBe('CINCO CON 00/100');
    });

    it('debe convertir numeros especiales de 10 a 15', () => {
      expect(numeroALetras(10)).toBe('DIEZ CON 00/100');
      expect(numeroALetras(11)).toBe('ONCE CON 00/100');
      expect(numeroALetras(15)).toBe('QUINCE CON 00/100');
    });

    it('debe convertir numeros de 16 a 19 en mayusculas completas', () => {
      expect(numeroALetras(16)).toBe('DIECISEIS CON 00/100');
      expect(numeroALetras(17)).toBe('DIECISIETE CON 00/100');
      expect(numeroALetras(18)).toBe('DIECIOCHO CON 00/100');
      expect(numeroALetras(19)).toBe('DIECINUEVE CON 00/100');
    });

    it('debe convertir veintes en mayusculas completas', () => {
      expect(numeroALetras(20)).toBe('VEINTE CON 00/100');
      expect(numeroALetras(21)).toBe('VEINTIUN CON 00/100');
      expect(numeroALetras(22)).toBe('VEINTIDOS CON 00/100');
      expect(numeroALetras(23)).toBe('VEINTITRES CON 00/100');
      expect(numeroALetras(29)).toBe('VEINTINUEVE CON 00/100');
    });

    it('debe convertir decenas con conjuncion Y', () => {
      expect(numeroALetras(30)).toBe('TREINTA CON 00/100');
      expect(numeroALetras(35)).toBe('TREINTA Y CINCO CON 00/100');
      expect(numeroALetras(99)).toBe('NOVENTA Y NUEVE CON 00/100');
    });

    it('debe convertir centenas', () => {
      expect(numeroALetras(100)).toBe('CIEN CON 00/100');
      expect(numeroALetras(101)).toBe('CIENTO UN CON 00/100');
      expect(numeroALetras(115)).toBe('CIENTO QUINCE CON 00/100');
      expect(numeroALetras(500)).toBe('QUINIENTOS CON 00/100');
    });

    it('debe convertir miles', () => {
      expect(numeroALetras(1000)).toBe('MIL CON 00/100');
      expect(numeroALetras(1500)).toBe('MIL QUINIENTOS CON 00/100');
      expect(numeroALetras(2000)).toBe('DOS MIL CON 00/100');
      expect(numeroALetras(80000)).toBe('OCHENTA MIL CON 00/100');
    });

    it('debe convertir millones', () => {
      expect(numeroALetras(1000000)).toBe('UN MILLON CON 00/100');
      expect(numeroALetras(2000000)).toBe('DOS MILLONES CON 00/100');
      expect(numeroALetras(2500120.35)).toBe('DOS MILLONES QUINIENTOS MIL CIENTO VEINTE CON 35/100');
    });

    it('debe manejar centavos correctamente', () => {
      expect(numeroALetras(10.5)).toBe('DIEZ CON 50/100');
      expect(numeroALetras(0.05)).toBe('CERO CON 05/100');
    });

    it('debe manejar montos negativos con valor absoluto', () => {
      expect(numeroALetras(-15.25)).toBe('QUINCE CON 25/100');
    });
  });

  describe('importeEnLetras', () => {
    it('debe formatear con prefijo del ticket', () => {
      expect(importeEnLetras(80000)).toBe('Son PESOS ARGENTINOS (ARS) OCHENTA MIL CON 00/100');
    });
  });
});
