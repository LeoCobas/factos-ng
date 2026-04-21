import {
  getFriendlyNetworkErrorMessage,
  isLikelyNetworkError,
  isLikelyNetworkErrorMessage,
} from './network-error.util';

describe('getFriendlyNetworkErrorMessage', () => {
  const fallbackMessage = 'No se pudo consultar el CUIT. Intenta nuevamente en unos minutos.';
  const offlineMessage =
    'No se pudo completar la consulta porque no hay conexion a internet. Verifica la red e intenta nuevamente.';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prioriza el estado offline del navegador', () => {
    vi.stubGlobal(
      'navigator',
      Object.create(globalThis.navigator, {
        onLine: { value: false, configurable: true },
      }),
    );

    const message = getFriendlyNetworkErrorMessage(new Error('boom'), fallbackMessage);

    expect(message).toBe(offlineMessage);
  });

  it('mapea el Failed to fetch a un mensaje entendible', () => {
    const message = getFriendlyNetworkErrorMessage(new TypeError('Failed to fetch'), fallbackMessage);

    expect(message).toBe(offlineMessage);
  });

  it('mantiene el fallback cuando no es un error de red', () => {
    const message = getFriendlyNetworkErrorMessage(new Error('CUIT no encontrado'), fallbackMessage);

    expect(message).toBe(fallbackMessage);
  });

  it('detecta mensajes amigables de conexion para reutilizarlos en UI', () => {
    expect(
      isLikelyNetworkErrorMessage(
        'No se pudo emitir la factura porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
      ),
    ).toBe(true);
  });

  it('detecta directamente un error tecnico de fetch', () => {
    expect(isLikelyNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });
});
