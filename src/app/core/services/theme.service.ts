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

  readonly theme = signal<ThemeMode>(this.get() ?? 'auto');
  
  // Computed que indica si el tema activo es oscuro
  readonly isDark = computed(() => {
    const mode = this.theme();
    const prefersDark = this.media?.matches ?? false;
    return mode === 'dark' || (mode === 'auto' && prefersDark);
  });

  constructor() {
    // Apply theme classes when theme or system preference changes
    effect(() => {
      const mode = this.theme();
      this.save(mode);
      const isDark = this.isDark();
      const root = this.doc.documentElement;
      
      // Remove previous theme classes
      root.classList.remove('light-theme', 'dark-theme');
      
      // Apply appropriate theme class
      if (isDark) {
        root.classList.add('dark-theme');
      } else {
        root.classList.add('light-theme');
      }
      
      // Update PWA theme-color meta tag
      const metaThemeColor = this.doc.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
      }
    });

    // Listen for OS scheme changes only when in auto mode
    if (this.media) {
      const handleMediaChange = () => {
        if (this.theme() === 'auto') {
          // Trigger re-evaluation of computed when system preference changes
          this.theme.update(current => current);
        }
      };
      
      this.media.addEventListener('change', handleMediaChange);
      this.destroyRef.onDestroy(() => {
        this.media?.removeEventListener('change', handleMediaChange);
      });
    }
  }

  setTheme(mode: ThemeMode) { 
    this.theme.set(mode); 
  }

  private get(): ThemeMode | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const v = localStorage.getItem('theme');
      return v === 'light' || v === 'dark' || v === 'auto' ? v : null;
    } catch {
      return null;
    }
  }

  private save(v: ThemeMode): void {
    if (typeof localStorage === 'undefined') return;
    try { 
      localStorage.setItem('theme', v); 
    } catch { 
      /* no-op */ 
    }
  }
}
