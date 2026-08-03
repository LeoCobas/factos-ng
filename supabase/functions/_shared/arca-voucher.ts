export interface VoucherFiscalData {
  concepto?: number;
  docTipo?: number;
  docNro?: number;
  cbteDesde?: number;
  cbteHasta?: number;
  cbteFch?: string | number;
  impTotal?: number;
  monId?: string;
  monCotiz?: number;
  codAutorizacion?: string;
  fchVto?: string;
  resultado?: string;
}
export interface ExpectedVoucherData {
  concepto: number;
  docTipo: number;
  docNro: number;
  cbteNro: number;
  cbteFch: number;
  impTotal: number;
  monId: string;
  monCotiz: number;
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeVoucherInfo(value: any): VoucherFiscalData | null {
  if (!value) return null;
  const source = value.resultGet ?? value.ResultGet ?? value.response?.resultGet ?? value;
  if (!source || source.errors?.err?.length || source.Errors?.Err?.length) return null;

  return {
    concepto: asNumber(source.concepto ?? source.Concepto),
    docTipo: asNumber(source.docTipo ?? source.DocTipo),
    docNro: asNumber(source.docNro ?? source.DocNro),
    cbteDesde: asNumber(source.cbteDesde ?? source.CbteDesde),
    cbteHasta: asNumber(source.cbteHasta ?? source.CbteHasta),
    cbteFch: source.cbteFch ?? source.CbteFch,
    impTotal: asNumber(source.impTotal ?? source.ImpTotal),
    monId: source.monId ?? source.MonId,
    monCotiz: asNumber(source.monCotiz ?? source.MonCotiz),
    codAutorizacion: source.codAutorizacion ?? source.CodAutorizacion,
    fchVto: source.fchVto ?? source.FchVto,
    resultado: source.resultado ?? source.Resultado,
  };
}

export function voucherMatchesExpected(
  voucher: VoucherFiscalData | null,
  expected: ExpectedVoucherData,
): boolean {
  if (!voucher) return false;
  const normalizedDate = Number(String(voucher.cbteFch ?? '').replace(/-/g, ''));

  return (
    voucher.concepto === expected.concepto &&
    voucher.docTipo === expected.docTipo &&
    voucher.docNro === expected.docNro &&
    voucher.cbteDesde === expected.cbteNro &&
    normalizedDate === expected.cbteFch &&
    Math.abs(Number(voucher.impTotal) - expected.impTotal) <= 0.01 &&
    voucher.monId === expected.monId &&
    Math.abs(Number(voucher.monCotiz) - expected.monCotiz) <= 0.000001
  );
}
