import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface LoginFormModel {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
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
                [class.btn-loading--active]="loading()"
                [attr.aria-busy]="loading()"
                class="btn-primary btn-loading w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span class="btn-loading__content">
                  @if (loading()) {
                    <span class="btn-loading__spinner" aria-hidden="true"></span>
                    <span>Iniciando sesi&oacute;n...</span>
                  } @else {
                    <span>Iniciar Sesi&oacute;n</span>
                  }
                </span>
              </button>
            </form>

            <div class="mt-4 text-center">
              <p class="text-sm text-muted-foreground">
                ¿No tenés una cuenta? 
                <a routerLink="/register" class="text-primary font-medium hover:underline">Registrate</a>
              </p>
            </div>
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
