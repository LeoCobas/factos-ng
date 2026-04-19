export type FiscalProfile =
  | 'responsable-inscripto'
  | 'monotributo'
  | 'exento'
  | 'no-inscripto'
  | 'no-alcanzado'
  | 'sin-datos'
  | 'ambiguo';

export interface ConstanciaFiscalData {
  condicionIva: string;
  fiscalProfile: FiscalProfile;
  reliable: boolean;
  message: string;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getString(value: unknown): string {
  return String(value || '').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
}

function getNestedRecord(
  source: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    const candidate = source[key];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return {};
}

function normalizeTaxState(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return '';
  if (normalized === 'ACTIVO') return 'AC';
  if (normalized === 'EXENTO') return 'EX';
  return normalized;
}

interface TaxSummary {
  id: number | null;
  description: string;
  state: string;
}

function getTaxEntries(source: Record<string, unknown>): TaxSummary[] {
  return [...asEntries(source['impuesto']), ...asEntries(source['impuestos'])].map((entry) => {
    if (typeof entry === 'number' || typeof entry === 'string') {
      const numericId = Number(entry);

      return {
        id: Number.isFinite(numericId) ? numericId : null,
        description: '',
        state: 'AC',
      };
    }

    const record = asRecord(entry);
    const numericId = Number(record['idImpuesto'] ?? record['id'] ?? record['impuesto']);

    return {
      id: Number.isFinite(numericId) ? numericId : null,
      description: normalizeText(record['descripcionImpuesto'] ?? record['descripcion']),
      state: normalizeTaxState(record['estadoImpuesto'] ?? record['estado']),
    };
  });
}

function hasMonotributoCategory(datosMonotributo: Record<string, unknown>): boolean {
  return (
    asEntries(datosMonotributo['categoriaMonotributo']).length > 0 ||
    getString(datosMonotributo['categoria']).length > 0
  );
}

export function extractFiscalDataFromConstancia(persona: Record<string, unknown>): ConstanciaFiscalData {
  const datosMonotributo = getNestedRecord(persona, 'datosMonotributo');
  const datosRegimenGeneral = getNestedRecord(persona, 'datosRegimenGeneral');
  const monotributoTaxes = getTaxEntries(datosMonotributo);
  const regimenGeneralTaxes = getTaxEntries(datosRegimenGeneral);
  const monotributoActive =
    hasMonotributoCategory(datosMonotributo) ||
    monotributoTaxes.some((tax) => {
      return (
        tax.id === 20 ||
        (tax.description.includes('monotributo') && (!tax.state || tax.state === 'AC'))
      );
    });

  const ivaTax = regimenGeneralTaxes.find((tax) => {
    return (
      tax.id === 30 ||
      tax.description === 'iva' ||
      tax.description.includes('impuesto al valor agregado')
    );
  });

  const ivaState = ivaTax?.state || (ivaTax?.id === 30 ? 'AC' : '');

  if (monotributoActive && ivaState === 'AC') {
    return {
      condicionIva: 'No categorizado',
      fiscalProfile: 'ambiguo',
      reliable: false,
      message: 'La constancia informa Monotributo e IVA activos al mismo tiempo.',
    };
  }

  if (monotributoActive) {
    return {
      condicionIva: 'Responsable Monotributo',
      fiscalProfile: 'monotributo',
      reliable: true,
      message: 'Condicion fiscal verificada por constancia de inscripcion.',
    };
  }

  switch (ivaState) {
    case 'AC':
      return {
        condicionIva: 'IVA Responsable Inscripto',
        fiscalProfile: 'responsable-inscripto',
        reliable: true,
        message: 'Condicion fiscal verificada por constancia de inscripcion.',
      };
    case 'EX':
      return {
        condicionIva: 'Exento',
        fiscalProfile: 'exento',
        reliable: true,
        message: 'Constancia con IVA exento.',
      };
    case 'NI':
      return {
        condicionIva: 'No Inscripto',
        fiscalProfile: 'no-inscripto',
        reliable: true,
        message: 'La constancia indica que el cliente no esta inscripto en IVA.',
      };
    case 'NA':
    case 'XN':
    case 'AN':
      return {
        condicionIva: 'No Alcanzado',
        fiscalProfile: 'no-alcanzado',
        reliable: true,
        message: 'La constancia indica que el cliente no esta alcanzado por IVA.',
      };
    default:
      break;
  }

  const errorRegimenGeneral = getNestedRecord(persona, 'errorRegimenGeneral');
  const errorMonotributo = getNestedRecord(persona, 'errorMonotributo');
  const hint =
    getString(errorRegimenGeneral['error']) ||
    getString(errorRegimenGeneral['mensaje']) ||
    getString(errorMonotributo['error']) ||
    getString(errorMonotributo['mensaje']) ||
    'La constancia no devolvio impuestos suficientes para clasificar al cliente.';

  return {
    condicionIva: 'No categorizado',
    fiscalProfile: 'sin-datos',
    reliable: false,
    message: hint,
  };
}
