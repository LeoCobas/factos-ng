export function getFriendlyNetworkErrorMessage(
  error: unknown,
  fallbackMessage: string,
  offlineMessage = 'No se pudo completar la consulta porque no hay conexion a internet. Verifica la red e intenta nuevamente.'
): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return offlineMessage;
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.trim().toLowerCase();

    if (
      error.name === 'TypeError' &&
      (normalizedMessage.includes('failed to fetch') ||
        normalizedMessage.includes('fetch failed') ||
        normalizedMessage.includes('networkerror') ||
        normalizedMessage.includes('load failed'))
    ) {
      return offlineMessage;
    }
  }

  return fallbackMessage;
}
