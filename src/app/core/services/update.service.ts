import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Signal que indica si hay una versión nueva lista para activarse.
   */
  readonly updateAvailable = signal(false);

  constructor() {
    this.init();
  }

  private init(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // 1. Escuchar cuando el Service Worker haya descargado una nueva versión
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.updateAvailable.set(true);
      });

    // 2. Chequeo periódico cada 1 hora
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const intervalId = setInterval(() => {
      this.checkForUpdate();
    }, ONE_HOUR_MS);

    this.destroyRef.onDestroy(() => clearInterval(intervalId));

    // 3. Chequear actualización cuando el usuario vuelve a enfocar la solapa
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.checkForUpdate();
      });
  }

  /**
   * Consulta a Netlify / Service Worker si existe una actualización pendiente.
   */
  async checkForUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    try {
      await this.swUpdate.checkForUpdate();
    } catch (error) {
      console.warn('[UpdateService] Error al verificar actualizaciones:', error);
    }
  }

  /**
   * Activa la nueva versión y recarga la página.
   */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      window.location.reload();
      return;
    }

    try {
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.error('[UpdateService] Error al activar actualización:', error);
      window.location.reload();
    }
  }
}
