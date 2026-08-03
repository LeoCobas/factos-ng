describe('runtime-config', () => {
  const config = {
    supabase: {
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    },
  };

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    delete window.__FACTOS_RUNTIME_CONFIG__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carga la configuracion de runtime sin persistirla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => config,
      }),
    );

    const { loadRuntimeConfig } = await import('./runtime-config');
    const result = await loadRuntimeConfig();

    expect(result).toEqual(config);
    expect(localStorage.getItem('factos.runtime-config')).toBeNull();
  });

  it('no reutiliza configuracion persistida cuando falla la red', async () => {
    localStorage.setItem('factos.runtime-config', JSON.stringify(config));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { loadRuntimeConfig } = await import('./runtime-config');

    await expect(loadRuntimeConfig()).rejects.toThrow('No se pudo iniciar la app');
  });
});
