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
            <!-- Logo -->
            <div class="flex justify-center mb-4">
              <img 
                src="/logo.png" 
                alt="Factos Logo" 
                class="h-12 w-auto"
              />
            </div>
            <h2 class="text-2xl font-semibold leading-none tracking-tight text-foreground">Iniciar Sesión</h2>
            <p class="text-sm text-muted-foreground mt-2">
              Ingresa a tu cuenta de FACTOS
            </p>
          </div>
          
          <div class="p-6 pt-0">
            <form (ngSubmit)="onSubmit()" class="space-y-4">
              <div>
                <label for="email" class="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="tu@email.com"
                  autocomplete="email"
                  [value]="emailValue()"
                  (input)="onEmailInput($event)"
                  class="form-input flex h-10 w-full px-3 py-2 text-sm"
                />
              </div>
              
              <div>
                <label for="password" class="form-label">
                  Contraseña
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  [value]="passwordValue()"
                  (input)="onPasswordInput($event)"
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
            </form>
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
    // Una validación de email simple pero efectiva
    const emailValid = email.length > 3 && email.includes('@') && email.includes('.');
    return emailValid && password.length > 0;
  });

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  onEmailInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    console.log('Email input:', value);
    this.emailValue.set(value);
  }

  onPasswordInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    console.log('Password input:', value);
    this.passwordValue.set(value);
  }

  async onSubmit() {
    // Capturar valores directamente del DOM en caso de autocompletado
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    
    let email = this.emailValue();
    let password = this.passwordValue();
    
    // Si los valores están vacíos en los signals pero existen en el DOM, usarlos
    if (!email && emailInput?.value) {
      email = emailInput.value;
      this.emailValue.set(email);
    }
    if (!password && passwordInput?.value) {
      password = passwordInput.value;
      this.passwordValue.set(password);
    }
    
    console.log('Form submitted - Email:', email, 'Password:', password);
    
    if (!email || !password) {
      console.log('Form invalid, not submitting');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.authService.signIn(email, password);
      
      if (error) {
        this.error.set(error.message || 'Error al iniciar sesión');
      }
      // Si no hay error, el AuthService ya redirige automáticamente
    } catch (err) {
      this.error.set('Error inesperado. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
