export type ClienteCondicionIva =
  | 'IVA Responsable Inscripto'
  | 'Responsable Monotributo'
  | 'Consumidor Final'
  | 'Exento'
  | 'No categorizado';

export interface ClienteFacturaData {
  cuit?: string | null;
  nombre?: string | null;
  domicilio?: string | null;
  condicion_iva?: string | null;
  doc_tipo?: number | null;
  doc_nro?: number | null;
}

export function sanitizeCuit(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

export function normalizeCondicionIva(value: string | null | undefined): ClienteCondicionIva {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized) {
    return 'Consumidor Final';
  }

  if (normalized.includes('monotrib')) {
    return 'Responsable Monotributo';
  }

  if (
    normalized.includes('inscripto') ||
    normalized.includes('regimen general') ||
    normalized.includes('iva activo') ||
    normalized.includes('impuesto al valor agregado')
  ) {
    return 'IVA Responsable Inscripto';
  }

  if (normalized.includes('exento')) {
    return 'Exento';
  }

  if (normalized.includes('consumidor final')) {
    return 'Consumidor Final';
  }

  return 'No categorizado';
}

export function resolveTipoComprobante(
  emisorCondicionIva: string | null | undefined,
  clienteCondicionIva?: string | null,
  fallback: string = 'FACTURA C'
): 'FACTURA A' | 'FACTURA B' | 'FACTURA C' {
  const emisor = normalizeCondicionIva(emisorCondicionIva);
  const cliente = normalizeCondicionIva(clienteCondicionIva);

  if (emisor === 'Responsable Monotributo' || emisor === 'Exento') {
    return 'FACTURA C';
  }

  if (emisor === 'IVA Responsable Inscripto') {
    return cliente === 'IVA Responsable Inscripto' ? 'FACTURA A' : 'FACTURA B';
  }

  const upperFallback = fallback.toUpperCase();
  if (upperFallback === 'FACTURA A' || upperFallback === 'FACTURA B' || upperFallback === 'FACTURA C') {
    return upperFallback;
  }

  return 'FACTURA C';
}

export function getNotaCreditoTipo(tipoComprobante: string | null | undefined): 'NOTA DE CREDITO A' | 'NOTA DE CREDITO B' | 'NOTA DE CREDITO C' {
  const normalized = String(tipoComprobante || '').toUpperCase();

  if (normalized.includes(' A')) {
    return 'NOTA DE CREDITO A';
  }

  if (normalized.includes(' B')) {
    return 'NOTA DE CREDITO B';
  }

  return 'NOTA DE CREDITO C';
}

export function getClienteDocData(cliente?: ClienteFacturaData | null): { docTipo: number; docNro: number } {
  const cuit = sanitizeCuit(cliente?.cuit);

  if (cliente?.doc_tipo && cliente?.doc_nro) {
    return {
      docTipo: Number(cliente.doc_tipo),
      docNro: Number(cliente.doc_nro),
    };
  }

  if (cuit.length === 11) {
    return {
      docTipo: 80,
      docNro: Number(cuit),
    };
  }

  return {
    docTipo: 99,
    docNro: 0,
  };
}

export function getCondicionIvaReceptorId(condicionIva: string | null | undefined): number {
  const normalized = normalizeCondicionIva(condicionIva);

  switch (normalized) {
    case 'IVA Responsable Inscripto':
      return 1;
    case 'Exento':
      return 4;
    case 'Consumidor Final':
      return 5;
    case 'Responsable Monotributo':
      return 6;
    default:
      return 5;
  }
}
