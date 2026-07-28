import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdateService } from '../../../core/services/update.service';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    @if (updateService.updateAvailable() && !dismissed()) {
      <div 
        role="alert" 
        aria-live="polite"
        class="fixed bottom-5 right-5 z-50 flex max-w-md items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 dark:border-blue-400/30 dark:bg-slate-900/95"
      >
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-100">Nueva versión disponible</span>
            <span class="text-xs text-slate-400">Actualizá para disfrutar de las últimas mejoras y correcciones.</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <app-button 
            variant="default" 
            size="sm" 
            class="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition-all"
            (click)="updateService.activateUpdate()"
          >
            Actualizar
          </app-button>
          <button 
            type="button"
            class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            (click)="dismiss()"
            aria-label="Cerrar aviso"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  readonly updateService = inject(UpdateService);
  readonly dismissed = signal(false);

  dismiss(): void {
    this.dismissed.set(true);
  }
}
