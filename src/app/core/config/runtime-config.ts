import { getFriendlyNetworkErrorMessage } from '../utils/network-error.util';

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

export interface RuntimeConfig {
  supabase: SupabaseRuntimeConfig;
}

declare global {
  interface Window {
    __FACTOS_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

let runtimeConfig: RuntimeConfig | null = null;

function assertSupabaseConfig(config: RuntimeConfig): RuntimeConfig {
  const url = String(config.supabase?.url || '').trim();
  const anonKey = String(config.supabase?.anonKey || '').trim();

  if (!url) {
    throw new Error('Runtime config incompleta: falta supabase.url');
  }

  if (!anonKey) {
    throw new Error('Runtime config incompleta: falta supabase.anonKey');
  }

  return {
    supabase: {
      url,
      anonKey,
    },
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  try {
    const response = await fetch('/app-config.json', {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `No se pudo cargar /app-config.json (status ${response.status}). Configura Supabase antes de iniciar la app.`,
      );
    }

    runtimeConfig = assertSupabaseConfig((await response.json()) as RuntimeConfig);
    window.__FACTOS_RUNTIME_CONFIG__ = runtimeConfig;
    return runtimeConfig;
  } catch (error) {
    const cachedWindowConfig =
      typeof window !== 'undefined' && window.__FACTOS_RUNTIME_CONFIG__
        ? assertSupabaseConfig(window.__FACTOS_RUNTIME_CONFIG__)
        : null;

    if (cachedWindowConfig) {
      runtimeConfig = cachedWindowConfig;
      if (typeof window !== 'undefined') {
        window.__FACTOS_RUNTIME_CONFIG__ = cachedWindowConfig;
      }
      return cachedWindowConfig;
    }

    throw new Error(
      getFriendlyNetworkErrorMessage(
        error,
        error instanceof Error ? error.message : 'No se pudo cargar la configuracion inicial.',
        'No se pudo iniciar la app porque no hay conexion a internet y no existe una configuracion previa guardada en este dispositivo.',
      ),
    );
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  if (typeof window !== 'undefined' && window.__FACTOS_RUNTIME_CONFIG__) {
    runtimeConfig = assertSupabaseConfig(window.__FACTOS_RUNTIME_CONFIG__);
    return runtimeConfig;
  }

  throw new Error(
    'Runtime config no inicializada. main.ts debe cargar /app-config.json antes de usar Supabase.',
  );
}
