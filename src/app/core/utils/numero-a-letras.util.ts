/**
 * Convierte un número a su representación en letras en español argentino.
 * Ej: 80000.00 → "OCHENTA MIL CON 00/100"
 */

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ESPECIALES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE'];
const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function convertirGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  let resultado = '';

  // Centenas
  const centena = Math.floor(n / 100);
  if (centena > 0) {
    resultado += CENTENAS[centena] + ' ';
  }

  const resto = n % 100;

  if (resto === 0) {
    return resultado.trim();
  }

  // Especiales (10-15)
  if (resto >= 10 && resto <= 15) {
    resultado += ESPECIALES[resto - 10];
    return resultado.trim();
  }

  // 16-19
  if (resto >= 16 && resto <= 19) {
    resultado += 'DIECI' + UNIDADES[resto - 10].toLowerCase();
    return resultado.trim();
  }

  // 21-29
  if (resto >= 21 && resto <= 29) {
    resultado += 'VEINTI' + UNIDADES[resto - 20].toLowerCase();
    return resultado.trim();
  }

  // 20
  if (resto === 20) {
    resultado += 'VEINTE';
    return resultado.trim();
  }

  // 30+
  const decena = Math.floor(resto / 10);
  const unidad = resto % 10;

  if (decena > 0) {
    resultado += DECENAS[decena];
    if (unidad > 0) {
      resultado += ' Y ' + UNIDADES[unidad];
    }
  } else if (unidad > 0) {
    resultado += UNIDADES[unidad];
  }

  return resultado.trim();
}

export function numeroALetras(monto: number): string {
  if (monto === 0) return 'CERO CON 00/100';

  const parteEntera = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - parteEntera) * 100);
  const centavosStr = centavos.toString().padStart(2, '0');

  if (parteEntera === 0) {
    return `CERO CON ${centavosStr}/100`;
  }

  let texto = '';

  // Millones
  const millones = Math.floor(parteEntera / 1000000);
  if (millones > 0) {
    if (millones === 1) {
      texto += 'UN MILLON ';
    } else {
      texto += convertirGrupo(millones) + ' MILLONES ';
    }
  }

  // Miles
  const miles = Math.floor((parteEntera % 1000000) / 1000);
  if (miles > 0) {
    if (miles === 1) {
      texto += 'MIL ';
    } else {
      texto += convertirGrupo(miles) + ' MIL ';
    }
  }

  // Unidades
  const unidades = parteEntera % 1000;
  if (unidades > 0) {
    texto += convertirGrupo(unidades);
  }

  return `${texto.trim()} CON ${centavosStr}/100`;
}

/**
 * Formato completo para el ticket: "Son PESOS ARGENTINOS (ARS) OCHENTA MIL CON 00/100"
 */
export function importeEnLetras(monto: number): string {
  return `Son PESOS ARGENTINOS (ARS) ${numeroALetras(monto)}`;
}
