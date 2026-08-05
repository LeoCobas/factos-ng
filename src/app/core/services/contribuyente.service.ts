import { Injectable, signal, computed } from '@angular/core';
import { supabase } from './supabase.service';
import { Contribuyente, ContribuyenteInsert, ContribuyenteUpdate } from '../types/database.types';
import { getFriendlyNetworkErrorMessage } from '../utils/network-error.util';

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
  readonly errorCarga = signal<string | null>(null);

  // Computed útiles
  readonly tieneContribuyente = computed(() => !!this.contribuyente());

  private usuarioInicializadoId: string | null = null;
  private cargaId = 0;

  reiniciarEstado(): void {
    this.cargaId++;
    this.usuarioInicializadoId = null;
    this.contribuyente.set(null);
    this.cargando.set(false);
    this.inicializado.set(false);
    this.errorCarga.set(null);
  }

  async cargarContribuyente(force = false): Promise<void> {
    const estadoId = this.cargaId;
    let cargaActualId: number | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (estadoId !== this.cargaId) {
        return;
      }

      if (!user) {
        this.contribuyente.set(null);
        this.usuarioInicializadoId = null;
        this.errorCarga.set(null);
        this.inicializado.set(true);
        return;
      }

      if (this.inicializado() && this.usuarioInicializadoId === user.id && !force) {
        return;
      }

      if (this.usuarioInicializadoId !== user.id) {
        this.contribuyente.set(null);
        this.inicializado.set(false);
      }

      this.usuarioInicializadoId = user.id;
      cargaActualId = ++this.cargaId;
      this.cargando.set(true);
      this.errorCarga.set(null);

      const { data, error } = await supabase
        .from('contribuyentes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cargaActualId !== this.cargaId) {
        return;
      }

      if (error) {
        console.error('Error cargando contribuyente:', error);
        this.errorCarga.set(
          getFriendlyNetworkErrorMessage(
            error,
            'No se pudieron cargar los datos del contribuyente.',
            'No se pudieron cargar los datos del contribuyente porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
          ),
        );
        return;
      }

      this.contribuyente.set(data);

    } catch (error) {
      const cargaSigueVigente =
        cargaActualId === null ? estadoId === this.cargaId : cargaActualId === this.cargaId;
      if (!cargaSigueVigente) {
        return;
      }

      console.error('Error inesperado cargando contribuyente:', error);
      this.errorCarga.set(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudieron cargar los datos del contribuyente.',
          'No se pudieron cargar los datos del contribuyente porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
      );
    } finally {
      const cargaSigueVigente =
        cargaActualId === null ? estadoId === this.cargaId : cargaActualId === this.cargaId;
      if (cargaSigueVigente) {
        this.cargando.set(false);
        this.inicializado.set(true);
      }
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
      return {
        success: false,
        error: getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error desconocido',
          'No se pudieron guardar los datos de facturacion porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
      };
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
      return {
        success: false,
        error: getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error desconocido',
          'No se pudieron actualizar los datos de facturacion porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
      };
    }
  }
}
