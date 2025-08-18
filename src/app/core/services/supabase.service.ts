import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { environment } from '../../../environments/environment';

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

export const supabase = createClient<Database>(
  environment.supabase.url,
  environment.supabase.anonKey,
  {
    auth: {
      storage: lockFreeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Usar un storageKey único para esta app
      storageKey: 'factos-ng-supabase-auth',
      // Deshabilitar completamente el lock manager
      lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
        // Ejecutar directamente sin locks para evitar conflictos
        return await fn();
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'factos-ng@1.0.0',
      },
    },
  }
);
