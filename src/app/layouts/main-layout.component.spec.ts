import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../core/services/auth.service';
import { ContribuyenteService } from '../core/services/contribuyente.service';
import { ThemeService } from '../core/services/theme.service';
import { ConfiguracionComponent } from '../features/configuracion/configuracion.component';
import { MainLayoutComponent } from './main-layout.component';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  template: '<div data-testid="configuracion-modal-content">Configuracion modal</div>',
})
class ConfiguracionStubComponent {}

describe('MainLayoutComponent', () => {
  const createContribuyenteServiceStub = () => ({
    inicializado: signal(true),
    contribuyente: signal(null),
    errorCarga: signal(null),
    cargarContribuyente: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([
          {
            path: 'facturar',
            component: ConfiguracionStubComponent,
          },
        ]),
        {
          provide: AuthService,
          useValue: {
            signOut: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: createContribuyenteServiceStub(),
        },
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false),
          },
        },
      ],
    })
      .overrideComponent(MainLayoutComponent, {
        remove: { imports: [ConfiguracionComponent] },
        add: { imports: [ConfiguracionStubComponent] },
      })
      .compileComponents();

    await TestBed.inject(Router).navigateByUrl('/facturar');
  });

  it('abre configuracion como modal desde el header', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const headerButton = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('button.header-btn'),
    ).find(button => button.textContent?.includes('Configuraci'));

    headerButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="dialog"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="configuracion-modal-content"]')).toBeTruthy();
  });

  it('cierra el modal de configuracion sin navegar', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    fixture.componentInstance.abrirConfiguracion();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('.config-modal-close')?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="dialog"]')).toBeFalsy();
    expect(TestBed.inject(Router).url).toBe('/facturar');
  });
});
