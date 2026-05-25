import { Injectable, signal } from '@angular/core';
import type { TabId } from '../../features/configuracion/configuracion.types';

@Injectable({
  providedIn: 'root',
})
export class UiService {
  readonly mostrarConfiguracion = signal(false);
  readonly configuracionTabActiva = signal<TabId | null>(null);

  abrirConfiguracion(tabId: TabId | null = null): void {
    if (tabId) {
      this.configuracionTabActiva.set(tabId);
    }
    this.mostrarConfiguracion.set(true);
  }

  cerrarConfiguracion(): void {
    this.mostrarConfiguracion.set(false);
  }
}
