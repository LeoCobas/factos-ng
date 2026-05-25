import { TestBed } from '@angular/core/testing';
import { ConfiguracionMercadopagoFormComponent } from './configuracion-mercadopago-form.component';

describe('ConfiguracionMercadopagoFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracionMercadopagoFormComponent],
    }).compileComponents();
  });

  it('debe crearse el componente', () => {
    const fixture = TestBed.createComponent(ConfiguracionMercadopagoFormComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('debe validar el input vacio y deshabilitar el boton', async () => {
    const fixture = TestBed.createComponent(ConfiguracionMercadopagoFormComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('tieneToken', false);
    fixture.componentRef.setInput('guardando', false);
    fixture.componentRef.setInput('mensaje', null);
    fixture.detectChanges();

    expect(component.formGroup.invalid).toBe(true);

    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBe(true);
  });

  it('debe habilitar el boton y emitir el valor al escribir y enviar', async () => {
    const fixture = TestBed.createComponent(ConfiguracionMercadopagoFormComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('tieneToken', false);
    fixture.componentRef.setInput('guardando', false);
    fixture.componentRef.setInput('mensaje', null);
    fixture.detectChanges();

    let emittedValue: string | null = null;
    component.guardar.subscribe(val => emittedValue = val);

    component.formGroup.controls.token.setValue('APP_USR-123456');
    fixture.detectChanges();

    expect(component.formGroup.controls.token.valid).toBe(true);

    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBe(false);

    component.onSubmit();
    expect(emittedValue).toBe('APP_USR-123456');
    expect(component.formGroup.controls.token.value).toBe('');
  });
});
