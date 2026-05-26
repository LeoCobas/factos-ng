import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { getRuntimeConfig } from '../config/runtime-config';
import { Database } from '../types/database.types';

// Storage que evita completamente los navigator locks
const lockFreeStorage = {
  getItem: (key: string) => {
    try {
      return globalThis?.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      globalThis?.localStorage?.setItem(key, value);
    } catch {
      // Fail silently si no se puede escribir
    }
  },
  removeItem: (key: string) => {
    try {
      globalThis?.localStorage?.removeItem(key);
    } catch {
      // Fail silently si no se puede eliminar
    }
  },
};

let client: SupabaseClient<Database> | null = null;

function createSupabaseClient() {
  const config = getRuntimeConfig();

  return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: {
      storage: lockFreeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Usar un storageKey unico para esta app
      storageKey: 'factos-ng-supabase-auth',
      // Ejecutar sin lock manager para evitar conflictos con navigator.locks
      lock: async <T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>) => {
        return await fn();
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'factos-ng@1.0.0',
      },
    },
  });
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    client = createSupabaseClient();
  }

  return client;
}

export const supabase = {
  get auth() {
    return getSupabaseClient().auth;
  },
  from(relation: string) {
    return getSupabaseClient().from(relation);
  },
} as any;
