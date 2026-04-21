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

  it('guarda en cache la configuracion luego de cargarla', async () => {
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
    expect(JSON.parse(localStorage.getItem('factos.runtime-config') || '{}')).toEqual(config);
  });

  it('usa la configuracion cacheada cuando falla la red', async () => {
    localStorage.setItem('factos.runtime-config', JSON.stringify(config));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { loadRuntimeConfig } = await import('./runtime-config');
    const result = await loadRuntimeConfig();

    expect(result).toEqual(config);
  });
});
