import { Component, input, output } from '@angular/core';

export type ComprobanteResultadoActionId = 'ver' | 'compartir' | 'descargar' | 'imprimir';

export interface ComprobanteResultadoAction {
  id: ComprobanteResultadoActionId;
  label: string;
  title: string;
}

@Component({
  selector: 'app-comprobante-resultado-panel',
  standalone: true,
  template: `
    <section class="receipt-result-panel card-surface animate-slide-up">
      <div class="receipt-result-panel__header">
        <div class="receipt-result-panel__status-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div class="receipt-result-panel__content">
          <p class="receipt-result-panel__eyebrow">{{ eyebrow() }}</p>
          <h3 class="receipt-result-panel__title">{{ title() }}</h3>

          @if (subtitle()) {
            <p class="receipt-result-panel__subtitle">{{ subtitle() }}</p>
          }

          @if (meta()) {
            <p class="receipt-result-panel__meta">{{ meta() }}</p>
          }
        </div>
      </div>

      @if (actions().length > 0) {
        <div class="receipt-result-panel__toolbar">
          <button
            type="button"
            class="receipt-result-panel__toggle"
            (click)="toggleActions.emit()"
            [attr.aria-expanded]="actionsOpen()"
          >
            <span>{{ actionsOpen() ? 'Ocultar acciones' : 'Ver acciones' }}</span>
            <svg
              class="receipt-result-panel__toggle-icon"
              [class.receipt-result-panel__toggle-icon--open]="actionsOpen()"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        @if (actionsOpen()) {
          <div class="receipt-action-grid">
            @for (action of actions(); track action.id) {
              <button
                type="button"
                class="receipt-action-btn"
                [attr.title]="action.title"
                [attr.aria-label]="action.title"
                (click)="actionSelected.emit(action.id)"
              >
                <span class="receipt-action-btn__icon" aria-hidden="true">
                  @switch (action.id) {
                    @case ('ver') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    }
                    @case ('compartir') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                        />
                      </svg>
                    }
                    @case ('descargar') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 3v12m0 0 4-4m-4 4-4-4m-3 8h14"
                        />
                      </svg>
                    }
                    @case ('imprimir') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                    }
                  }
                </span>
                <span class="receipt-action-btn__label">{{ action.label }}</span>
              </button>
            }
          </div>
        }
      }

      <button type="button" class="receipt-result-panel__close" (click)="closeRequested.emit()">
        {{ closeLabel() }}
      </button>
    </section>
  `,
})
export class ComprobanteResultadoPanelComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly meta = input('');
  readonly actions = input<ComprobanteResultadoAction[]>([]);
  readonly actionsOpen = input(false);
  readonly closeLabel = input('Cerrar');

  readonly actionSelected = output<ComprobanteResultadoActionId>();
  readonly toggleActions = output<void>();
  readonly closeRequested = output<void>();
}
