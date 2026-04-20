import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js';

import { supabase } from './supabase.service';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly authState = signal<AuthState>({
    user: null,
    session: null,
    loading: true,
  });
  private readonly redirectUrl = signal<string | null>(null);

  private readonly initializationPromise: Promise<void>;
  private resolveInitialization!: () => void;
  private initialized = false;

  readonly user = computed(() => this.authState().user);
  readonly session = computed(() => this.authState().session);
  readonly loading = computed(() => this.authState().loading);
  readonly isAuthenticated = computed(() => !!this.authState().user);

  constructor() {
    this.initializationPromise = new Promise<void>((resolve) => {
      this.resolveInitialization = resolve;
    });

    void this.initializeAuth();
  }

  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  setRedirectUrl(url: string | null): void {
    this.redirectUrl.set(url);
  }

  async signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    this.authState.update((state) => ({ ...state, loading: true }));

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    this.authState.update((state) => ({ ...state, loading: false }));
    return { error };
  }

  async signUp(email: string, password: string): Promise<{ error: AuthError | null }> {
    this.authState.update((state) => ({ ...state, loading: true }));

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    this.authState.update((state) => ({ ...state, loading: false }));
    return { error };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    this.authState.update((state) => ({ ...state, loading: true }));

    const { error } = await supabase.auth.signOut();

    this.authState.update((state) => ({ ...state, loading: false }));
    return { error };
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  }

  private async initializeAuth(): Promise<void> {
    try {
      const session = await this.getSessionWithRetry();

      this.authState.set({
        user: session?.user ?? null,
        session,
        loading: false,
      });

      supabase.auth.onAuthStateChange((event, nextSession) => {
        this.authState.set({
          user: nextSession?.user ?? null,
          session: nextSession,
          loading: false,
        });

        void this.handleNavigationEvent(event);
      });
    } catch (error) {
      console.warn('Error inicializando auth, continuando sin autenticacion:', error);
      this.authState.set({
        user: null,
        session: null,
        loading: false,
      });
    } finally {
      this.markInitialized();
    }
  }

  private markInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.resolveInitialization();
  }

  private async handleNavigationEvent(event: AuthChangeEvent): Promise<void> {
    if (event === 'SIGNED_IN') {
      const targetUrl = this.redirectUrl();
      this.redirectUrl.set(null);
      await this.router.navigateByUrl(targetUrl || '/');
      return;
    }

    if (event === 'SIGNED_OUT') {
      this.redirectUrl.set(null);
      await this.router.navigate(['/login']);
    }
  }

  private async getSessionWithRetry(maxRetries = 2): Promise<Session | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn(`Supabase auth error attempt ${attempt}:`, error.message);
          if (attempt < maxRetries) {
            continue;
          }
          throw error;
        }

        return session;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Auth session retry ${attempt}/${maxRetries}:`, message);

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }

        console.warn(
          'Todas las tentativas de obtener sesion fallaron, continuando sin autenticacion',
        );
        return null;
      }
    }

    return null;
  }
}
