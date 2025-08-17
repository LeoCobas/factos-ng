import { Injectable } from '@angular/core';

// ⚠️ SERVICIO DEPRECADO ⚠️
// Este servicio está siendo reemplazado por FacturacionService
// Solo se mantiene para evitar errores de compilación

@Injectable({
  providedIn: 'root'
})
export class TusFacturasService {
  
  constructor() {
    console.warn('⚠️ TusFacturasService está deprecado. Usar FacturacionService');
  }

  // Método placeholder para compatibilidad
  configurar(): void {
    console.warn('Usar FacturacionService.emitirFactura() en su lugar');
  }
}
