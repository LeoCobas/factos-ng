import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface TusFacturasConfig {
  usuario: string;
  password: string;
  endpoint: string;
}

export interface FacturaEmitir {
  fecha: string;
  tipoDocumento: number; // 80 = CUIT, 96 = DNI, 99 = Consumidor Final
  numeroDocumento?: string;
  tipoResponsable: number; // 5 = Consumidor Final
  condicionIva: number; // 6 = Consumidor Final
  condicionPago: number; // 1 = Contado
  moneda: string; // 'PES' = Pesos argentinos
  cotizacion: number; // 1 para pesos
  observaciones?: string;
  items: ItemFactura[];
}

export interface ItemFactura {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  alicuotaIva: number; // 21, 10.5, 0, etc.
  importeIva?: number;
}

export interface RespuestaEmision {
  codigo: number;
  mensaje: string;
  errores?: string[];
  comprobante?: {
    numero: string;
    cae: string;
    fechaVencimientoCae: string;
    puntoVenta: number;
    tipoComprobante: number;
    letra: string;
    fechaEmision: string;
    importeTotal: number;
    urlPdf?: string;
  };
}

export interface ConfiguracionEmpresa {
  cuit: string;
  razonSocial: string;
  domicilio: string;
  condicionIva: string;
  puntoVenta: number;
  actividad: string;
}

@Injectable({
  providedIn: 'root'
})
export class TusFacturasService {
  private config = signal<TusFacturasConfig | null>(null);
  private configuracionEmpresa = signal<ConfiguracionEmpresa | null>(null);
  
  // Estado de conexión
  conectado = signal<boolean>(false);
  ultimaVerificacion = signal<Date | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Configura las credenciales de TusFacturas
   */
  configurar(config: TusFacturasConfig): void {
    this.config.set(config);
    localStorage.setItem('tf_config', JSON.stringify(config));
  }

  /**
   * Carga la configuración desde localStorage
   */
  cargarConfiguracion(): void {
    const saved = localStorage.getItem('tf_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.config.set(config);
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    }
  }

  /**
   * Verifica la conexión con TusFacturas
   */
  verificarConexion(): Observable<boolean> {
    const config = this.config();
    if (!config) {
      return throwError(() => new Error('No hay configuración de TusFacturas'));
    }

    const headers = this.getHeaders();
    
    return this.http.get(`${config.endpoint}/empresas`, { headers }).pipe(
      map(() => {
        this.conectado.set(true);
        this.ultimaVerificacion.set(new Date());
        return true;
      }),
      catchError(error => {
        this.conectado.set(false);
        console.error('Error de conexión con TusFacturas:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene la configuración de la empresa
   */
  obtenerConfiguracionEmpresa(): Observable<ConfiguracionEmpresa> {
    const config = this.config();
    if (!config) {
      return throwError(() => new Error('No hay configuración de TusFacturas'));
    }

    const headers = this.getHeaders();
    
    return this.http.get<any>(`${config.endpoint}/empresas`, { headers }).pipe(
      map(response => {
        const empresa = response.data?.[0] || response;
        const configuracion: ConfiguracionEmpresa = {
          cuit: empresa.cuit || '',
          razonSocial: empresa.razonSocial || '',
          domicilio: empresa.domicilio || '',
          condicionIva: empresa.condicionIva || '',
          puntoVenta: empresa.puntoVenta || 1,
          actividad: empresa.actividad || ''
        };
        this.configuracionEmpresa.set(configuracion);
        return configuracion;
      }),
      catchError(error => {
        console.error('Error al obtener configuración de empresa:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Emite una factura a consumidor final
   */
  emitirFacturaConsumidorFinal(
    descripcion: string, 
    monto: number, 
    fecha?: string
  ): Observable<RespuestaEmision> {
    const config = this.config();
    if (!config) {
      return throwError(() => new Error('No hay configuración de TusFacturas'));
    }

    const fechaEmision = fecha || new Date().toISOString().split('T')[0];
    
    const factura: FacturaEmitir = {
      fecha: fechaEmision,
      tipoDocumento: 99, // Consumidor Final
      tipoResponsable: 5, // Consumidor Final
      condicionIva: 6, // Consumidor Final
      condicionPago: 1, // Contado
      moneda: 'PES',
      cotizacion: 1,
      observaciones: '',
      items: [{
        descripcion: descripcion,
        cantidad: 1,
        precio: monto,
        alicuotaIva: 21, // IVA 21%
        importeIva: monto * 0.21
      }]
    };

    const headers = this.getHeaders();
    
    return this.http.post<RespuestaEmision>(
      `${config.endpoint}/comprobantes`, 
      factura, 
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error al emitir factura:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene el PDF de una factura
   */
  obtenerPdf(numeroComprobante: string): Observable<Blob> {
    const config = this.config();
    if (!config) {
      return throwError(() => new Error('No hay configuración de TusFacturas'));
    }

    const headers = this.getHeaders();
    
    return this.http.get(
      `${config.endpoint}/comprobantes/${numeroComprobante}/pdf`,
      { 
        headers,
        responseType: 'blob'
      }
    ).pipe(
      catchError(error => {
        console.error('Error al obtener PDF:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Lista las facturas emitidas
   */
  listarFacturas(
    fechaDesde?: string, 
    fechaHasta?: string
  ): Observable<any[]> {
    const config = this.config();
    if (!config) {
      return throwError(() => new Error('No hay configuración de TusFacturas'));
    }

    const headers = this.getHeaders();
    let url = `${config.endpoint}/comprobantes`;
    
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fechaDesde', fechaDesde);
    if (fechaHasta) params.append('fechaHasta', fechaHasta);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.http.get<any>(url, { headers }).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error al listar facturas:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene los headers HTTP necesarios
   */
  private getHeaders(): HttpHeaders {
    const config = this.config();
    if (!config) {
      throw new Error('No hay configuración de TusFacturas');
    }

    const credentials = btoa(`${config.usuario}:${config.password}`);
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json'
    });
  }

  /**
   * Obtiene el estado de la configuración
   */
  estaConfigurado(): boolean {
    const config = this.config();
    return !!(config?.usuario && config?.password && config?.endpoint);
  }

  /**
   * Limpia la configuración
   */
  limpiarConfiguracion(): void {
    this.config.set(null);
    this.configuracionEmpresa.set(null);
    this.conectado.set(false);
    this.ultimaVerificacion.set(null);
    localStorage.removeItem('tf_config');
  }
}
