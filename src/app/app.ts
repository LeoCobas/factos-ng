import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
  `,
  styles: []
})
export class App {
  title = 'FACTOS - Angular';
  
  // Force ThemeService initialization
  private themeService = inject(ThemeService);

  constructor() {
    // Theme service is now initialized
  }
}
