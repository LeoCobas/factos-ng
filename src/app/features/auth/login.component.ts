import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface LoginFormModel {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8"
    >
      <div class="max-w-md w-full">
        <div class="card-surface">
          <div class="p-6 text-center">
            <div class="flex justify-center mb-4">
              <img [src]="logoSrc()" alt="Factos Logo" class="h-12 w-auto" />
            </div>
            <h2 class="text-2xl font-semibold leading-none tracking-tight text-foreground">
              Iniciar Sesion
            </h2>
            <p class="text-sm text-muted-foreground mt-2">Ingresa a tu cuenta de FACTOS</p>
          </div>

          <div class="p-6 pt-0">
            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
              <div>
                <label for="email" class="form-label">Email</label>
                <input
                  type="email"
                  id="email"
                  formControlName="email"
                  placeholder="tu@email.com"
                  autocomplete="email"
                  class="form-input flex h-10 w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label for="password" class="form-label">Contrasena</label>
                <input
                  type="password"
                  id="password"
                  formControlName="password"
                  placeholder="********"
                  autocomplete="current-password"
                  class="form-input flex h-10 w-full px-3 py-2 text-sm"
                />
              </div>

              @if (error()) {
                <div class="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p class="text-sm text-destructive">{{ error() }}</p>
                </div>
              }

              <button
                type="submit"
                [disabled]="loading() || form.invalid"
                class="btn-primary w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                @if (loading()) {
                  <span
                    class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"
                  ></span>
                }
                {{ loading() ? 'Iniciando sesion...' : 'Iniciar Sesion' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly themeService = inject(ThemeService);

  readonly form = new FormGroup<LoginFormModel>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly logoSrc = computed(() => (this.themeService.isDark() ? '/logob.png' : '/logo.png'));

  constructor() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.authService.setRedirectUrl(returnUrl);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    try {
      const { error } = await this.authService.signIn(email, password);

      if (error) {
        this.error.set(error.message || 'Error al iniciar sesion');
      }
    } catch {
      this.error.set('Error inesperado. Intentalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
