import { Component, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div class="max-w-md w-full">
        <div class="card-surface">
          <div class="p-6 text-center">
            <div class="flex justify-center mb-4">
              <img src="/logo.png" alt="Factos Logo" class="h-12 w-auto" />
            </div>
            <h2 class="text-2xl font-semibold leading-none tracking-tight text-foreground">Iniciar Sesión</h2>
            <p class="text-sm text-muted-foreground mt-2">Ingresa a tu cuenta de FACTOS</p>
          </div>
          
          <div class="p-6 pt-0">
            <div class="space-y-4">
              <div>
                <label for="email" class="form-label">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="tu@email.com"
                  autocomplete="email"
                  [value]="emailValue()"
                  (input)="onEmailInput($event)"
                  (focus)="syncFromDOM()"
                  class="form-input flex h-10 w-full px-3 py-2 text-sm"
                />
              </div>
              
              <div>
                <label for="password" class="form-label">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  [value]="passwordValue()"
                  (input)="onPasswordInput($event)"
                  (focus)="syncFromDOM()"
                  class="form-input flex h-10 w-full px-3 py-2 text-sm"
                />
              </div>

              @if (error()) {
                <div class="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p class="text-sm text-destructive">{{ error() }}</p>
                </div>
              }

              <button
                type="button"
                (click)="onSubmit()"
                [disabled]="loading() || !isFormValid()"
                class="btn-primary w-full inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                @if (loading()) {
                  <span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                }
                {{ loading() ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [CommonModule]
})
export class LoginComponent {
  loading = signal(false);
  error = signal<string | null>(null);
  
  emailValue = signal('');
  passwordValue = signal('');
  
  isFormValid = computed(() => {
    const email = this.emailValue();
    const password = this.passwordValue();
    const emailValid = email.length > 3 && email.includes('@') && email.includes('.');
    return emailValid && password.length > 0;
  });

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  syncFromDOM() {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    
    if (emailInput?.value && !this.emailValue()) {
      this.emailValue.set(emailInput.value);
    }
    if (passwordInput?.value && !this.passwordValue()) {
      this.passwordValue.set(passwordInput.value);
    }
  }

  onEmailInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.emailValue.set(value);
  }

  onPasswordInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.passwordValue.set(value);
  }

  async onSubmit() {
    // Sincronizar una última vez para capturar autocompletado
    this.syncFromDOM();

    if (!this.isFormValid()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const email = this.emailValue();
    const password = this.passwordValue();

    try {
      const { error } = await this.authService.signIn(email, password);
      
      if (error) {
        this.error.set(error.message || 'Error al iniciar sesión');
      }
    } catch (err) {
      this.error.set('Error inesperado. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
