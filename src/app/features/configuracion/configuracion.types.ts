import { FormControl } from '@angular/forms';

export type TabId = 'facturacion' | 'certificado' | 'mercadopago' | 'cuenta';
export type Actividad = 'bienes' | 'servicios';

export interface MensajeEstado {
  texto: string;
  tipo: 'success' | 'error';
}

export interface FacturacionFormModel {
  cuit: FormControl<string>;
  razon_social: FormControl<string>;
  nombre_fantasia: FormControl<string>;
  domicilio: FormControl<string>;
  condicion_iva: FormControl<string>;
  ingresos_brutos: FormControl<string>;
  inicio_actividades: FormControl<string>;
  punto_venta: FormControl<number | null>;
  concepto: FormControl<string>;
  iva_porcentaje: FormControl<string>;
  actividad: FormControl<Actividad>;
  monto_maximo_factura: FormControl<number | null>;
}

export interface CertFormModel {
  arca_production: FormControl<boolean>;
}

export interface AccountFormModel {
  nuevoEmail: FormControl<string>;
  nuevaPassword: FormControl<string>;
  confirmarPassword: FormControl<string>;
}
