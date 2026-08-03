export type ArcaEmissionStatus =
  'pending' | 'authorized' | 'persisted' | 'rejected' | 'uncertain' | 'conflict';

export interface PreparedEmission {
  attempt_existing: boolean;
  attempt: {
    status: ArcaEmissionStatus | string;
    cbte_nro: number | null;
    [key: string]: unknown;
  };
  comprobante: Record<string, unknown> | null;
  ultimo_comprobante?: number | null;
  [key: string]: unknown;
}

export type PreparedEmissionAction =
  | 'return_persisted'
  | 'reject_terminal'
  | 'recover_voucher'
  | 'fetch_last_voucher'
  | 'create_voucher';

export function getPreparedVoucherNumber(prepared: PreparedEmission): number | null {
  const number = prepared.attempt?.cbte_nro;
  return number !== null && Number.isInteger(Number(number)) && Number(number) > 0
    ? Number(number)
    : null;
}

export function getPreparedEmissionAction(prepared: PreparedEmission): PreparedEmissionAction {
  const status = prepared.attempt?.status;

  if (status === 'persisted' && prepared.comprobante) return 'return_persisted';
  if (status === 'rejected' || status === 'conflict' || status === 'persisted') {
    return 'reject_terminal';
  }

  const cbteNro = getPreparedVoucherNumber(prepared);
  if (
    prepared.attempt_existing &&
    cbteNro !== null &&
    (status === 'pending' || status === 'uncertain' || status === 'authorized')
  ) {
    return 'recover_voucher';
  }

  return cbteNro === null ? 'fetch_last_voucher' : 'create_voucher';
}
