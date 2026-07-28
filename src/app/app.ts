import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { UpdateBannerComponent } from './shared/components/ui/update-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateBannerComponent],
  template: `
    <router-outlet />
    <app-update-banner />
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
