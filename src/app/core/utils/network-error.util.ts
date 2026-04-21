export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();

  return (
    error.name === 'TypeError' &&
    (normalizedMessage.includes('failed to fetch') ||
      normalizedMessage.includes('fetch failed') ||
      normalizedMessage.includes('networkerror') ||
      normalizedMessage.includes('load failed'))
  );
}

export function isLikelyNetworkErrorMessage(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();

  return (
    normalizedMessage.includes('conexion') ||
    normalizedMessage.includes('sin internet') ||
    normalizedMessage.includes('offline') ||
    normalizedMessage.includes('red') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch')
  );
}

export function getFriendlyNetworkErrorMessage(
  error: unknown,
  fallbackMessage: string,
  offlineMessage = 'No se pudo completar la consulta porque no hay conexion a internet. Verifica la red e intenta nuevamente.'
): string {
  if (isLikelyNetworkError(error)) {
    return offlineMessage;
  }

  return fallbackMessage;
}
