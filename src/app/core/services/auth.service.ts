import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase.service';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  
  // Signals para el estado de autenticación
  private authState = signal<AuthState>({
    user: null,
    session: null,
    loading: true
  });

  // Computed signals derivados
  user = computed(() => this.authState().user);
  session = computed(() => this.authState().session);
  loading = computed(() => this.authState().loading);
  isAuthenticated = computed(() => !!this.authState().user);

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Obtener sesión inicial
      const { data: { session } } = await supabase.auth.getSession();
      
      this.authState.set({
        user: session?.user ?? null,
        session,
        loading: false
      });

      // Escuchar cambios en la autenticación
      supabase.auth.onAuthStateChange((event, session) => {
        this.authState.set({
          user: session?.user ?? null,
          session,
          loading: false
        });

        if (event === 'SIGNED_OUT') {
          this.router.navigate(['/login']);
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      this.authState.set({
        user: null,
        session: null,
        loading: false
      });
    }
  }

  async signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    this.authState.update(state => ({ ...state, loading: true }));
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    this.authState.update(state => ({ ...state, loading: false }));

    if (!error) {
      this.router.navigate(['/']);
    }

    return { error };
  }

  async signUp(email: string, password: string): Promise<{ error: AuthError | null }> {
    this.authState.update(state => ({ ...state, loading: true }));
    
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    this.authState.update(state => ({ ...state, loading: false }));

    return { error };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    this.authState.update(state => ({ ...state, loading: true }));
    
    const { error } = await supabase.auth.signOut();
    
    this.authState.update(state => ({ ...state, loading: false }));

    return { error };
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  }
}
