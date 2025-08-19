import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'auto';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private media = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined;

  readonly theme = signal<ThemeMode>(this.load() ?? 'auto');

  constructor() {
    // Apply class when theme or system preference changes
    effect(() => {
      const mode = this.theme();
      this.save(mode);
      const prefersDark = this.media?.matches ?? false;
      const isDark = mode === 'dark' || (mode === 'auto' && prefersDark);
      const root = this.doc.documentElement;
      root.classList.toggle('dark', isDark);
    });

    // Listen for OS scheme changes only when in auto
    this.media?.addEventListener?.('change', () => {
      if (this.theme() === 'auto') {
        this.theme.update(v => v); // trigger effect
      }
    });
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
