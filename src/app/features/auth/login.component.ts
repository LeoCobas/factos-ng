import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="p-6 text-center">
            <h2 class="text-2xl font-semibold leading-none tracking-tight">Iniciar Sesión</h2>
            <p class="text-sm text-gray-600 mt-2">
              Ingresa a tu cuenta de FACTOS
            </p>
          </div>
          
          <div class="p-6 pt-0">
            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  formControlName="email"
                  class="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  [class.border-red-300]="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
                />
                @if (loginForm.get('email')?.invalid && loginForm.get('email')?.touched) {
                  <p class="mt-1 text-sm text-red-600">Email requerido</p>
                }
              </div>
              
              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  formControlName="password"
                  class="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  [class.border-red-300]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
                />
                @if (loginForm.get('password')?.invalid && loginForm.get('password')?.touched) {
                  <p class="mt-1 text-sm text-red-600">Contraseña requerida</p>
                }
              </div>

              @if (error()) {
                <div class="p-3 rounded-md bg-red-50 border border-red-200">
                  <p class="text-sm text-red-600">{{ error() }}</p>
                </div>
              }

              <button
                type="submit"
                [disabled]="loading() || loginForm.invalid"
                class="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (loading()) {
                  <span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                }
                {{ loading() ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [ReactiveFormsModule]
})
export class LoginComponent {
  loading = signal(false);
  error = signal<string | null>(null);

  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.loginForm.value;

    try {
      // Por ahora, simulamos el login
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navegar al dashboard
      this.router.navigate(['/']);
    } catch (err) {
      this.error.set('Error inesperado. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
