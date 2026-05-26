import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface RegisterFormModel {
  email: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div class="max-w-md w-full">
        <div class="card-surface">
          <div class="p-6 text-center">
            <div class="flex justify-center mb-4">
              <img [src]="logoSrc()" alt="Factos Logo" class="h-12 w-auto" />
            </div>
            <h2 class="text-2xl font-semibold leading-none tracking-tight text-foreground">
              Crear Cuenta
            </h2>
            <p class="text-sm text-muted-foreground mt-2">Registrate para empezar a facturar con FACTOS</p>
          </div>

          <div class="p-6 pt-0">
            @if (registrationSuccess()) {
              <div class="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center space-y-4">
                <p class="text-sm text-green-600 dark:text-green-400 font-medium">
                  ¡Registro exitoso! Enviamos un correo de confirmación a tu dirección de email. Por favor verificalo para poder ingresar.
                </p>
                <a routerLink="/login" class="btn-primary inline-block w-full text-center rounded-md px-4 py-2 text-sm font-medium">
                  Volver al Login
                </a>
              </div>
            } @else {
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
                  @if (form.controls.email.touched && form.controls.email.invalid) {
                    <p class="text-xs text-destructive mt-1">Ingresá un email válido</p>
                  }
                </div>

                <div>
                  <label for="password" class="form-label">Contraseña</label>
                  <input
                    type="password"
                    id="password"
                    formControlName="password"
                    placeholder="********"
                    autocomplete="new-password"
                    class="form-input flex h-10 w-full px-3 py-2 text-sm"
                  />
                  @if (form.controls.password.touched && form.controls.password.invalid) {
                    <p class="text-xs text-destructive mt-1">La contraseña debe tener al menos 6 caracteres</p>
                  }
                </div>

                <div>
                  <label for="confirmPassword" class="form-label">Confirmar Contraseña</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    formControlName="confirmPassword"
                    placeholder="********"
                    autocomplete="new-password"
                    class="form-input flex h-10 w-full px-3 py-2 text-sm"
                  />
                  @if (form.controls.confirmPassword.touched && form.hasError('mismatch')) {
                    <p class="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>
                  }
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
                      <span>Registrando...</span>
                    } @else {
                      <span>Registrarse</span>
                    }
                  </span>
                </button>
              </form>
              
              <div class="mt-4 text-center">
                <p class="text-sm text-muted-foreground">
                  ¿Ya tenés una cuenta? 
                  <a routerLink="/login" class="text-primary font-medium hover:underline">Iniciar Sesión</a>
                </p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  readonly form = new FormGroup<RegisterFormModel>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  }, {
    validators: (group) => {
      const pass = group.get('password')?.value;
      const confirm = group.get('confirmPassword')?.value;
      return pass === confirm ? null : { mismatch: true };
    }
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly registrationSuccess = signal(false);
  readonly logoSrc = computed(() => (this.themeService.isDark() ? '/logob.png' : '/logo.png'));

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    try {
      const { error } = await this.authService.signUp(email, password);

      if (error) {
        this.error.set(error.message || 'Error al registrarse');
      } else {
        this.registrationSuccess.set(true);
      }
    } catch {
      this.error.set('Error inesperado. Intentalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
