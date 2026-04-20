import { Injectable, signal, computed } from '@angular/core';
import { supabase } from './supabase.service';
import { Contribuyente, ContribuyenteInsert, ContribuyenteUpdate } from '../types/database.types';

export type CreateContribuyentePayload = Omit<ContribuyenteInsert, 'user_id'>;

@Injectable({
  providedIn: 'root'
})
export class ContribuyenteService {
  // El contribuyente del usuario (1:1)
  readonly contribuyente = signal<Contribuyente | null>(null);

  // Estado de carga
  readonly cargando = signal(false);
  readonly inicializado = signal(false);

  // Computed útiles
  readonly tieneContribuyente = computed(() => !!this.contribuyente());

  constructor() {}

  async cargarContribuyente(): Promise<void> {
    this.cargando.set(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.contribuyente.set(null);
        return;
      }

      const { data, error } = await supabase
        .from('contribuyentes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando contribuyente:', error);
        return;
      }

      this.contribuyente.set(data);

    } catch (error) {
      console.error('Error inesperado cargando contribuyente:', error);
    } finally {
      this.cargando.set(false);
      this.inicializado.set(true);
    }
  }

  async crearContribuyente(data: CreateContribuyentePayload): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'No hay sesión activa' };
      }

      const { data: nuevo, error } = await supabase
        .from('contribuyentes')
        .insert({
          ...data,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Ya tenés un contribuyente configurado' };
        }
        return { success: false, error: error.message };
      }

      this.contribuyente.set(nuevo);
      return { success: true };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }

  async actualizarContribuyente(data: ContribuyenteUpdate): Promise<{ success: boolean; error?: string }> {
    const contribuyente = this.contribuyente();
    if (!contribuyente) {
      return { success: false, error: 'No hay contribuyente configurado' };
    }

    try {
      const { data: actualizado, error } = await supabase
        .from('contribuyentes')
        .update(data)
        .eq('id', contribuyente.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      this.contribuyente.set(actualizado);
      return { success: true };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }
}
