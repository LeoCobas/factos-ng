import { Injectable, effect, inject, signal, computed, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'auto';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private media = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;

  readonly theme = signal<ThemeMode>(this.load() ?? 'auto');
  
  // Computed que indica si el tema activo es oscuro
  readonly isDark = computed(() => {
    const mode = this.theme();
    const prefersDark = this.media?.matches ?? false;
    return mode === 'dark' || (mode === 'auto' && prefersDark);
  });

  constructor() {
    // Apply class when theme or system preference changes
    effect(() => {
      const mode = this.theme();
      this.save(mode);
      const isDark = this.isDark();
      const root = this.doc.documentElement;
      root.classList.toggle('dark', isDark);
      
      // Update PWA theme-color meta tag
      const metaThemeColor = this.doc.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#18181b' : '#2563eb');
      }
    });

    // Listen for OS scheme changes only when in auto
    if (this.media) {
      const handleMediaChange = () => {
        if (this.theme() === 'auto') {
          this.theme.update(v => v); // trigger effect
        }
      };
      
      this.media.addEventListener('change', handleMediaChange);
      this.destroyRef.onDestroy(() => {
        this.media?.removeEventListener('change', handleMediaChange);
      });
    }
  }

  setTheme(mode: ThemeMode) { this.theme.set(mode); }

  private load(): ThemeMode | null {
    try {
      const v = localStorage.getItem('theme');
      return v === 'light' || v === 'dark' || v === 'auto' ? v : null;
    } catch {
      return null;
    }
  }

  private save(v: ThemeMode) {
    try { localStorage.setItem('theme', v); } catch { /* no-op */ }
  }
}
