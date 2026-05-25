import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MercadopagoService } from '../../core/services/mercadopago.service';
import { UiService } from '../../core/services/ui.service';
import type { MpPayment, MpBatchJob } from '../../core/types/mercadopago.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-mercadopago-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        (click)="closeOnBackdrop()"
      >
        <!-- Modal Card -->
        <div
          class="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden transition-all scale-100 duration-300"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2" />
                  <line x1="2" y1="10" x2="22" y2="10" stroke-width="2" />
                  <path d="M6 14h2" stroke-width="2" stroke-linecap="round" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-foreground">Importar desde Mercado Pago</h3>
                <p class="text-xs text-muted-foreground">Facturación por lotes a Consumidor Final</p>
              </div>
            </div>
            @if (!processing()) {
              <button
                type="button"
                (click)="cerrar()"
                class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full transition-colors"
                title="Cerrar"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            }
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Checking Config -->
            @if (!hasToken()) {
              <div class="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div class="p-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                  <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="space-y-1">
                  <h4 class="text-base font-semibold">Mercado Pago no está configurado</h4>
                  <p class="text-sm text-muted-foreground max-w-md">
                    Necesitás agregar tu Access Token en la sección de Configuración para poder importar tus pagos.
                  </p>
                </div>
                <button
                  type="button"
                  (click)="irAConfig()"
                  class="btn-primary rounded-lg px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
                >
                  Ir a Configuración
                </button>
              </div>
            } @else {
              <!-- Date Picker & Search -->
              @if (!processing() && !showSummary()) {
                <div class="grid grid-cols-1 sm:grid-cols-3 items-end gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                  <div class="form-field">
                    <label class="form-label text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Fecha Desde</label>
                    <input
                      type="datetime-local"
                      [ngModel]="beginDate()"
                      (ngModelChange)="beginDate.set($event)"
                      class="form-input text-sm"
                    />
                  </div>
                  <div class="form-field">
                    <label class="form-label text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Fecha Hasta</label>
                    <input
                      type="datetime-local"
                      [ngModel]="endDate()"
                      (ngModelChange)="endDate.set($event)"
                      class="form-input text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    (click)="buscarPagos()"
                    [disabled]="loading()"
                    class="btn-primary flex items-center justify-center gap-2 h-[42px] rounded-lg font-semibold transition-all"
                  >
                    @if (loading()) {
                      <span class="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent"></span>
                      <span>Buscando...</span>
                    } @else {
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Buscar Pagos</span>
                    }
                  </button>
                </div>

                <!-- Errors -->
                @if (searchError()) {
                  <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
                    <svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{{ searchError() }}</span>
                  </div>
                }

                <!-- Payments List -->
                @if (!loading() && payments().length === 0) {
                  <div class="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <svg class="h-12 w-12 text-muted-foreground/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4h16z" />
                    </svg>
                    <p class="text-sm">No se encontraron pagos aprobados pendientes de facturar en este rango de fechas.</p>
                  </div>
                } @else if (payments().length > 0) {
                  <div class="space-y-3">
                    <div class="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Mostrando {{ payments().length }} pagos encontrados</span>
                      <button
                        type="button"
                        (click)="toggleSelectAll()"
                        class="text-primary hover:underline font-semibold"
                      >
                        {{ allSelected() ? 'Deseleccionar todos' : 'Seleccionar todos' }}
                      </button>
                    </div>

                    <div class="border border-border/60 rounded-xl overflow-hidden bg-card">
                      <div class="overflow-x-auto max-h-[40vh]">
                        <table class="w-full text-left border-collapse">
                          <thead class="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border/80 text-xs font-semibold text-muted-foreground">
                            <tr>
                              <th class="p-3 w-12 text-center"></th>
                              <th class="p-3">Fecha</th>
                              <th class="p-3">Concepto / Descripción</th>
                              <th class="p-3">Cliente</th>
                              <th class="p-3 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-border/40 text-sm">
                            @for (p of payments(); track p.id) {
                              <tr
                                class="hover:bg-muted/10 transition-colors cursor-pointer"
                                (click)="togglePayment(p.id)"
                              >
                                <td class="p-3 text-center" (click)="$event.stopPropagation()">
                                  <input
                                    type="checkbox"
                                    [checked]="selectedIds().has(p.id)"
                                    (change)="togglePayment(p.id)"
                                    class="rounded border-border text-primary focus:ring-primary h-4 w-4"
                                  />
                                </td>
                                <td class="p-3 whitespace-nowrap text-muted-foreground">
                                  {{ formatDateTime(p.date_created) }}
                                </td>
                                <td class="p-3 font-medium text-foreground max-w-[240px] truncate" [title]="p.description || ''">
                                  {{ p.description || 'Sin descripción' }}
                                </td>
                                <td class="p-3 text-muted-foreground whitespace-nowrap">
                                  {{ formatPayerName(p.payer) }}
                                </td>
                                <td class="p-3 text-right font-bold text-foreground whitespace-nowrap">
                                  $ {{ p.transaction_amount | number:'1.2-2' }}
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                }
              }

              <!-- Realtime Processing State -->
              @if (processing()) {
                <div class="flex flex-col items-center justify-center py-10 space-y-6">
                  <div class="relative flex items-center justify-center">
                    <span class="absolute animate-ping inline-flex h-12 w-12 rounded-full bg-primary/20 opacity-75"></span>
                    <div class="relative p-4 bg-primary/10 text-primary rounded-full">
                      <span class="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent block"></span>
                    </div>
                  </div>

                  <div class="text-center space-y-2">
                    <h4 class="text-lg font-bold">Procesando lote de facturación</h4>
                    <p class="text-sm text-muted-foreground">
                      Emitiendo facturas electrónicas a Consumidor Final vía ARCA. No cierres la aplicación.
                    </p>
                  </div>

                  <!-- Progress Details -->
                  @if (batchJob(); as job) {
                    <div class="w-full max-w-md space-y-3">
                      <div class="flex items-center justify-between text-sm">
                        <span class="font-semibold text-muted-foreground">
                          Progreso: {{ job.processed_items }} / {{ job.total_items }}
                        </span>
                        <span class="font-bold text-primary">{{ progressPercent() }}%</span>
                      </div>
                      <!-- Progress Bar -->
                      <div class="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/40">
                        <div
                          class="h-full bg-gradient-to-r from-sky-500 to-primary transition-all duration-300 rounded-full"
                          [style.width.%]="progressPercent()"
                        ></div>
                      </div>

                      <div class="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                        <div class="p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                          <p class="text-green-600 dark:text-green-400 font-bold text-sm">{{ job.successful_items }}</p>
                          <p class="text-muted-foreground">Exitosas</p>
                        </div>
                        <div class="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <p class="text-amber-600 dark:text-amber-400 font-bold text-sm">{{ job.ignored_items }}</p>
                          <p class="text-muted-foreground">Ignoradas</p>
                        </div>
                        <div class="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                          <p class="text-red-600 dark:text-red-400 font-bold text-sm">{{ job.failed_items }}</p>
                          <p class="text-muted-foreground">Fallidas</p>
                        </div>
                      </div>
                    </div>
                  } @else {
                    <div class="w-full max-w-md space-y-2">
                      <div class="h-2.5 bg-muted animate-pulse rounded-full w-full"></div>
                      <p class="text-xs text-muted-foreground text-center animate-pulse">Iniciando lote...</p>
                    </div>
                  }
                </div>
              }

              <!-- Summary / Completion State -->
              @if (showSummary() && batchJob(); as job) {
                <div class="space-y-6">
                  <div class="flex flex-col items-center text-center p-6 rounded-2xl bg-muted/20 border border-border/40 space-y-3">
                    <div
                      class="p-3 rounded-full"
                      [class]="job.failed_items === job.total_items ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'"
                    >
                      @if (job.failed_items === job.total_items) {
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      } @else {
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    </div>

                    <div class="space-y-1">
                      <h4 class="text-lg font-bold">Lote Finalizado</h4>
                      <p class="text-sm text-muted-foreground">
                        Se procesaron {{ job.total_items }} transacciones en total.
                      </p>
                    </div>

                    <div class="flex items-center gap-4 py-2">
                      <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                        {{ job.successful_items }} Exitosas
                      </span>
                      @if (job.ignored_items > 0) {
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {{ job.ignored_items }} Ignoradas
                        </span>
                      }
                      @if (job.failed_items > 0) {
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                          {{ job.failed_items }} Fallidas
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Itemized Results -->
                  <div class="space-y-3">
                    <h5 class="text-sm font-bold text-foreground">Detalle de resultados</h5>
                    <div class="border border-border/60 rounded-xl overflow-hidden bg-card">
                      <div class="overflow-y-auto max-h-[30vh] divide-y divide-border/40 text-sm">
                        @for (item of job.results; track item.mp_payment_id) {
                          <div class="flex items-center justify-between p-3.5 hover:bg-muted/5 transition-colors">
                            <div class="flex items-center gap-3 min-w-0">
                              <span
                                class="h-2 w-2 rounded-full shrink-0"
                                [class]="
                                  item.status === 'facturado'
                                    ? 'bg-green-500'
                                    : item.status === 'ignorado'
                                      ? 'bg-amber-400'
                                      : 'bg-red-500'
                                "
                              ></span>
                              <div class="min-w-0">
                                <p class="font-medium text-foreground truncate">
                                  Pago #{{ item.mp_payment_id }}
                                </p>
                                @if (item.error) {
                                  <p class="text-xs text-red-500 truncate" [title]="item.error">
                                    {{ item.error }}
                                  </p>
                                } @else if (item.comprobante_numero) {
                                  <p class="text-xs text-muted-foreground font-mono">
                                    FC {{ item.comprobante_numero }}
                                  </p>
                                }
                              </div>
                            </div>
                            <span
                              class="text-xs font-semibold px-2 py-0.5 rounded capitalize"
                              [class]="
                                item.status === 'facturado'
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                  : item.status === 'ignorado'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                              "
                            >
                              {{ item.status }}
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Footer Actions -->
          @if (hasToken() && !processing()) {
            <div class="flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/10">
              @if (showSummary()) {
                <div class="flex items-center gap-3 w-full justify-between">
                  @if (batchJob() && batchJob()!.failed_items > 0) {
                    <button
                      type="button"
                      (click)="reintentarFallidas()"
                      class="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                      </svg>
                      <span>Reintentar fallidas ({{ batchJob()!.failed_items }})</span>
                    </button>
                  } @else {
                    <div></div>
                  }
                  <button
                    type="button"
                    (click)="cerrar()"
                    class="btn-primary rounded-lg px-5 py-2 text-sm font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              } @else {
                <div class="flex items-center justify-between w-full">
                  <div class="text-sm text-muted-foreground">
                    @if (selectedCount() > 0) {
                      <span class="font-bold text-foreground">{{ selectedCount() }}</span>
                      seleccionados para facturar
                    } @else {
                      Ningún pago seleccionado
                    }
                  </div>
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      (click)="cerrar()"
                      class="btn-secondary rounded-lg px-4 py-2 text-sm font-semibold border border-border"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      (click)="procesarLote()"
                      [disabled]="payments().length === 0 || selectedCount() === 0"
                      class="btn-primary rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/10"
                    >
                      Procesar Lote
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class MercadopagoImportModalComponent {
  readonly isOpen = model<boolean>(false);
  readonly batchCompleted = output<void>();

  private readonly mercadopagoService = inject(MercadopagoService);
  private readonly uiService = inject(UiService);

  readonly payments = signal<MpPayment[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly loading = signal<boolean>(false);
  readonly processing = signal<boolean>(false);
  readonly batchJob = signal<MpBatchJob | null>(null);
  readonly beginDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly searchError = signal<string | null>(null);
  readonly batchError = signal<string | null>(null);
  readonly showSummary = signal<boolean>(false);

  readonly hasToken = computed(() => this.mercadopagoService.hasMpToken());
  readonly allSelected = computed(
    () => this.payments().length > 0 && this.selectedIds().size === this.payments().length
  );
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly progressPercent = computed(() => {
    const job = this.batchJob();
    if (!job || job.total_items === 0) return 0;
    return Math.round((job.processed_items / job.total_items) * 100);
  });

  private realtimeChannel: RealtimeChannel | null = null;

  constructor() {
    // Watch for modal opening to load default dates and perform initial search
    effect(async () => {
      if (this.isOpen()) {
        this.resetState();
        this.loading.set(true);
        try {
          const begin = await this.mercadopagoService.getDefaultBeginDate();
          const end = this.mercadopagoService.getDefaultEndDate();
          this.beginDate.set(begin);
          this.endDate.set(end);

          if (this.mercadopagoService.hasMpToken()) {
            await this.buscarPagos();
          }
        } catch (err: any) {
          console.error('Error al inicializar modal MP:', err);
          this.searchError.set(err.message || 'Error al conectar con el servidor.');
        } finally {
          this.loading.set(false);
        }
      }
    }, { allowSignalWrites: true });
  }

  resetState() {
    this.payments.set([]);
    this.selectedIds.set(new Set());
    this.loading.set(false);
    this.processing.set(false);
    this.batchJob.set(null);
    this.searchError.set(null);
    this.batchError.set(null);
    this.showSummary.set(false);
    this.cleanupRealtime();
  }

  async buscarPagos() {
    this.loading.set(true);
    this.searchError.set(null);
    this.payments.set([]);
    this.selectedIds.set(new Set());

    try {
      // Format datetime-local to ISO with Argentina offset
      const beginISO = this.mercadopagoService.formatToISOWithOffset(this.beginDate());
      const endISO = this.mercadopagoService.formatToISOWithOffset(this.endDate());

      const res = await this.mercadopagoService.searchPayments(beginISO, endISO);

      if (res.success && res.data) {
        this.payments.set(res.data.payments || []);
        // Pre-select all
        const ids = new Set<string>();
        (res.data.payments || []).forEach((p) => ids.add(p.id));
        this.selectedIds.set(ids);
      } else {
        this.searchError.set(res.error || 'No se pudieron buscar los pagos.');
      }
    } catch (err: any) {
      this.searchError.set(err.message || 'Error al buscar pagos.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
    } else {
      const ids = new Set<string>();
      this.payments().forEach((p) => ids.add(p.id));
      this.selectedIds.set(ids);
    }
  }

  togglePayment(id: string) {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  async procesarLote() {
    if (this.selectedCount() === 0) return;

    this.processing.set(true);
    this.batchError.set(null);
    this.batchJob.set(null);
    this.showSummary.set(false);

    try {
      const selected = this.selectedIds();
      const facturarList: string[] = [];
      const ignorarList: string[] = [];
      const paymentsData: Record<string, any> = {};

      this.payments().forEach((p) => {
        const pName = this.formatPayerName(p.payer);
        paymentsData[p.id] = {
          transaction_amount: p.transaction_amount,
          date_created: p.date_created,
          description: p.description || null,
          payer_name: pName === 'Sin identificar' ? 'Consumidor Final' : pName,
        };

        if (selected.has(p.id)) {
          facturarList.push(p.id);
        } else {
          ignorarList.push(p.id);
        }
      });

      const batchJobId = await this.mercadopagoService.processBatch({
        facturar: facturarList,
        ignorar: ignorarList,
        payments_data: paymentsData,
      });

      // Subscribe to Realtime progress
      this.realtimeChannel = this.mercadopagoService.subscribeToBatchJob(
        batchJobId,
        (job: MpBatchJob) => {
          this.batchJob.set(job);
          if (job.status === 'completed' || job.status === 'failed') {
            this.processing.set(false);
            this.showSummary.set(true);
            this.batchCompleted.emit();
            this.cleanupRealtime();
          }
        }
      );
    } catch (err: any) {
      this.processing.set(false);
      this.batchError.set(err.message || 'Error al procesar el lote.');
      alert(err.message || 'Error al procesar el lote.');
    }
  }

  async reintentarFallidas() {
    const job = this.batchJob();
    if (!job || job.failed_items === 0) return;

    const failedIds = job.results
      .filter((r) => r.status === 'fallido')
      .map((r) => r.mp_payment_id);

    if (failedIds.length === 0) return;

    this.processing.set(true);
    this.batchError.set(null);
    this.batchJob.set(null);
    this.showSummary.set(false);

    try {
      const facturarList: string[] = [];
      const paymentsData: Record<string, any> = {};

      this.payments().forEach((p) => {
        if (failedIds.includes(p.id)) {
          facturarList.push(p.id);
          const pName = this.formatPayerName(p.payer);
          paymentsData[p.id] = {
            transaction_amount: p.transaction_amount,
            date_created: p.date_created,
            description: p.description || null,
            payer_name: pName === 'Sin identificar' ? 'Consumidor Final' : pName,
          };
        }
      });

      const batchJobId = await this.mercadopagoService.processBatch({
        facturar: facturarList,
        ignorar: [],
        payments_data: paymentsData,
      });

      this.realtimeChannel = this.mercadopagoService.subscribeToBatchJob(
        batchJobId,
        (newJob: MpBatchJob) => {
          this.batchJob.set(newJob);
          if (newJob.status === 'completed' || newJob.status === 'failed') {
            this.processing.set(false);
            this.showSummary.set(true);
            this.batchCompleted.emit();
            this.cleanupRealtime();
          }
        }
      );
    } catch (err: any) {
      this.processing.set(false);
      this.batchError.set(err.message || 'Error al reintentar.');
      alert(err.message || 'Error al reintentar.');
    }
  }

  cerrar() {
    this.isOpen.set(false);
    this.resetState();
  }

  closeOnBackdrop() {
    if (!this.processing()) {
      this.cerrar();
    }
  }

  irAConfig() {
    this.cerrar();
    this.uiService.abrirConfiguracion('mercadopago');
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  }

  formatPayerName(payer: MpPayment['payer']): string {
    if (!payer) return 'Sin identificar';
    const first = (payer.first_name || '').trim();
    const last = (payer.last_name || '').trim();
    const full = `${first} ${last}`.trim();
    return full || 'Sin identificar';
  }

  private cleanupRealtime() {
    if (this.realtimeChannel) {
      this.mercadopagoService.unsubscribe(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}
