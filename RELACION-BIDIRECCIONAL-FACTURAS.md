# 🔗 Funcionalidad de Relación Bidireccional - Facturas y Notas de Crédito

## ✅ **Implementación completada**

### 🎯 **Funcionalidad bidireccional**

Ahora el sistema muestra la relación completa entre facturas y notas de crédito en ambas direcciones:

#### **📋 Para Notas de Crédito:**
- ✅ Muestra: **"Anula factura: XXXXX"** (en naranja)
- ✅ Información obtenida directamente de la relación `factura_id` en la base de datos

#### **📋 Para Facturas Anuladas:**
- ✅ Muestra: **"Anulada por nota de crédito: XXXXX"** (en rojo)
- ✅ Búsqueda optimizada O(1) usando el `mapaFacturasAnuladas`

## 🚀 **Performance optimizada**

### **Sin impacto en performance:**
- ✅ **O(1) lookup**: Usa el Map ya existente `mapaFacturasAnuladas`
- ✅ **Sin consultas adicionales**: Reutiliza datos ya cargados
- ✅ **Computed signal**: Se actualiza automáticamente cuando cambian los datos
- ✅ **Solo datos del día**: Búsqueda limitada al conjunto pequeño del día seleccionado

### **Eficiencia garantizada:**
```typescript
// Búsqueda O(1) - Tiempo constante independiente del volumen
obtenerNotaCreditoQueAnula(factura: Factura): string | null {
  if (factura.estado !== 'anulada') return null;
  return this.mapaFacturasAnuladas().get(factura.numero_factura) || null;
}
```

## 📱 **Experiencia de usuario**

### **Información clara y visual:**

1. **🟠 Notas de Crédito:**
   ```
   NC B    00005    [Emitida]    -$15,000.00
   ↓ (expandir)
   🟠 Anula factura: 00004
   ```

2. **🔴 Facturas Anuladas:**
   ```
   FC B    00004    [Anulada]    $15,000.00
   ↓ (expandir)
   🔴 Anulada por nota de crédito: 00005
   ```

### **Colores diferenciados:**
- **🟠 Naranja**: Acción activa (esta nota anula una factura)
- **🔴 Rojo**: Estado pasivo (esta factura fue anulada por una nota)

## 🎯 **Casos de uso cubiertos**

### **✅ Navegación mental completa:**
- Usuario ve factura anulada → sabe exactamente qué nota la anuló
- Usuario ve nota de crédito → sabe exactamente qué factura anula
- Trazabilidad completa de operaciones de anulación

### **✅ Auditabilidad:**
- Historial claro de todas las anulaciones
- Relaciones visibles sin necesidad de buscar en otros lugares
- Información siempre disponible en el contexto correcto

## 💡 **Implementación técnica**

### **Template actualizado:**
```html
@if (!esNotaCredito(factura) && factura.estado === 'anulada') {
  <div class="font-medium text-red-600">
    Anulada por nota de crédito: {{ obtenerNotaCreditoQueAnula(factura) || 'N/A' }}
  </div>
}
```

### **Sin cambios en la lógica:**
- ✅ Usa el método `obtenerNotaCreditoQueAnula()` ya existente
- ✅ Aprovecha el `mapaFacturasAnuladas` computed signal
- ✅ Mantiene la performance O(1) existente

## 🚀 **Resultado final**

La aplicación ahora proporciona **navegación bidireccional completa** entre facturas y notas de crédito:

- **Performance**: Sin degradación, O(1) lookups
- **UX**: Información clara y contextual
- **Escalabilidad**: Funciona igual con 10 o 10,000 facturas
- **Mantenibilidad**: Código simple y eficiente

¡Funcionalidad completa implementada con cero impacto en performance! 🎉
