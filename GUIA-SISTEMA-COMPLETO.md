# FACTOS Angular - Sistema de Facturación Electrónica

## 🚀 Sistema Completado

Este proyecto Angular 20 es la nueva versión de FACTOS, especializada en la **facturación electrónica rápida para consumidor final** en Argentina a través de TusFacturas.app y Supabase.

## 📋 Funcionalidades Implementadas

### ✅ Componentes Principales

1. **Facturar** - Emisión rápida de facturas a consumidor final
   - **Mobile-first**: Optimizado para dispositivos lentos
   - **Solo monto + fecha**: Interfaz ultra-simplificada
   - **Cards de respuesta**: Verde (éxito) / Roja (error) sin recargar página
   - **Acciones post-emisión**: Ver PDF, Compartir, Imprimir, Volver
   - **Validaciones estrictas**: Máximo 2 decimales, tipado fuerte
   - **Flujo síncrono**: Emite directamente a AFIP, no guarda borradores

2. **Listado** - Gestión de facturas emitidas con datos reales
   - **Integración Supabase**: Datos en tiempo real desde base de datos
   - **Soporte para Notas de Crédito**: Visualización diferenciada (rojo)
   - **Filtrado inteligente**: Hoy, semana, mes con cálculos automáticos
   - **Acceso a PDFs**: Desde Supabase Storage

3. **Totales** - Estadísticas en tiempo real
   - **Datos reales**: Conexión directa con Supabase
   - **Comparaciones automáticas**: Hoy vs ayer, mes actual vs anterior
   - **Cálculos dinámicos**: Mejor día, ticket promedio, tendencias
   - **Soporte NC**: Incluye notas de crédito en estadísticas

4. **Configuración** - Setup completo del sistema
   - **React parity**: Funcionalidad idéntica a la versión React
   - **Gestión completa**: CUIT, razón social, punto de venta, API tokens
   - **Validación de campos**: Dropdowns sin opción por defecto
   - **Sin título**: UI limpia para mejor UX

### 🔧 Servicios Implementados

- **FacturacionService**: Sistema completo de facturación electrónica
  - **Flujo completo**: Validación → TusFacturas → Supabase DB → PDF Storage
  - **Edge Functions**: Integración con tf-proxy y pdf-proxy
  - **Tipado estricto**: Según documentación oficial de TusFacturas
  - **Manejo de estados**: Signals de Angular para reactividad
  - **Validaciones robustas**: Monto, fecha, estructura de comprobante
  - **Storage automático**: PDFs en Supabase Storage con estructura organizada

- **SupabaseService**: Integración con base de datos en tiempo real
  - Gestión de sesiones
  - CRUD de facturas y configuración
  - Storage de PDFs

- **AuthService**: Gestión de autenticación con Supabase
  - Login/logout con signals
  - Estados reactivos
  - Guards de protección de rutas

- **PdfService**: Acciones sobre PDFs (ver, compartir, descargar, imprimir)

## 🏗️ Arquitectura Actualizada

```
src/
├── app/
│   ├── core/                 # Servicios singleton
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── facturacion.service.ts    # 🆕 Servicio principal
│   │   │   ├── supabase.service.ts
│   │   │   └── pdf.service.ts            # Acciones sobre PDFs
│   │   ├── types/
│   │   │   └── database.types.ts         # Tipos generados de Supabase
│   │   └── guards/
│   │       └── auth.guard.ts
│   ├── features/             # Módulos por funcionalidad
│   │   ├── facturar/         # 🔄 Rediseñado completamente
│   │   ├── listado/          # 🔄 Integración Supabase real
│   │   ├── totales/          # 🔄 Datos en tiempo real
│   │   ├── configuracion/    # 🔄 React parity completo
│   │   └── auth/
│   ├── shared/               # Componentes reutilizables
│   │   ├── components/ui/
│   │   └── lib/utils.ts
│   ├── layouts/              # Layouts de página
│   │   └── main-layout.component.ts
│   └── environments/
└── supabase/
    └── functions/            # Edge Functions
        ├── tf-proxy/         # ✅ Proxy para TusFacturas API
        ├── pdf-proxy/        # ✅ Proxy para descarga PDFs
        └── _shared/cors.ts
```

### 🗄️ Base de Datos Supabase

```sql
-- Tabla principal de facturas (solo CAE válidos)
facturas:
  - id (uuid)
  - numero (integer)
  - fecha (date)
  - tipo_comprobante (text: 'FC', 'ND', 'NC')
  - total (numeric)
  - cae (text)
  - vencimiento_cae (date)
  - punto_venta (integer)
  - pdf_url (text) -- Ruta en Storage: facturas-pdf/
  - tf_id (integer) -- ID de TusFacturas
  - created_at (timestamp)

-- Tabla de notas de crédito
notas_credito:
  - id (uuid)
  - numero (integer)
  - fecha (date)
  - tipo_comprobante (text)
  - total (numeric)
  - cae (text)
  - vencimiento_cae (date)
  - punto_venta (integer)
  - pdf_url (text)
  - tf_id (integer)
  - created_at (timestamp)

-- Configuración del sistema
configuracion:
  - id (uuid)
  - cuit (text)
  - razon_social (text)
  - punto_venta (integer)
  - concepto (integer)
  - actividad (text)
  - iva_porcentaje (numeric)
  - tipo_comprobante_default (text)
  - api_token (text)
  - api_key (text)
  - user_token (text)
```

### 📁 Supabase Storage

```
Bucket: facturas-pdf (público)
Estructura organizativa:
facturas-pdf/
├── 2025/
│   ├── 08/
│   │   ├── 11/
│   │   │   ├── FC_00004_00000007.pdf
│   │   │   ├── FC_00004_00000013.pdf
│   │   │   └── ...
│   │   ├── 12/
│   │   ├── 13/
│   │   └── ...
│   └── ...
└── notas_credito/
    └── [misma estructura]
```

## 🎯 Flujo de Facturación Completo

### 1. Configuración Inicial (Una vez)
```
1. Ir a /configuracion
2. Completar TODOS los campos:
   - CUIT y razón social
   - Punto de venta y tipo de comprobante
   - Concepto y actividad AFIP
   - % IVA aplicable
   - Tokens de TusFacturas (api_token, api_key, user_token)
3. Guardar configuración en Supabase
```

### 2. Emisión de Factura (Flujo principal)
```
1. Ir a /facturar
2. Ingresar monto (auto-focus, máx 2 decimales)
3. Confirmar fecha (por defecto hoy)
4. Click "Emitir Factura"

🔄 Proceso automático:
   a) Validar configuración en Supabase
   b) Construir comprobante según API TusFacturas
   c) Validar estructura y monto
   d) Enviar a AFIP vía tf-proxy Edge Function
   e) Guardar en DB solo si CAE es válido
   f) Descargar PDF y guardar en facturas-pdf/YYYY/MM/DD/
   g) Mostrar card de éxito con acciones

5. Card de éxito:
   - Ver PDF (abre en nueva pestaña)
   - Compartir (Web Share API o clipboard)
   - Imprimir (iframe oculto)
   - Volver (limpia form y enfoca monto)
```

### 3. Manejo de Errores
```
Card roja con mensaje específico:
- Reintentar (mismos datos)
- Volver (limpiar formulario)

❌ Errores comunes:
- Configuración incompleta
- TusFacturas offline  
- Monto inválido
- Problemas de conectividad
```

## 🔑 Características Técnicas Avanzadas

### Angular 20 Moderno
- **Standalone components**: Sin NgModules
- **Signals**: Estado reactivo nativo
- **Control flow syntax**: @if, @for, @switch
- **Lazy loading**: Carga bajo demanda
- **TypeScript strict**: Tipado extremo para prevenir errores

### TailwindCSS v4 Mobile-First
- **Configuración optimizada**: PostCSS + CSS variables
- **Mobile-first**: Diseño responsivo desde 320px
- **Componentes UI**: Cards, botones, inputs consistentes
- **Animaciones**: Fade-in, loading states, transiciones

### Integración TusFacturas Robusta
- **Edge Functions**: tf-proxy para seguridad
- **Tipado estricto**: Según documentación oficial API
- **Solo consumidor final**: Flujo simplificado
- **Validaciones AFIP**: Estructura de comprobante completa
- **Manejo de errores**: Códigos específicos y mensajes claros

### Supabase Full-Stack
- **Real-time**: Datos en tiempo real con subscripciones
- **Edge Functions**: tf-proxy, pdf-proxy para APIs externas  
- **Storage**: facturas-pdf con estructura organizada
- **Auth**: JWT con Row Level Security
- **Tipos generados**: TypeScript para toda la DB

### Performance y UX
- **Lazy chunks**: Componentes por demanda (facturar: 38KB)
- **Auto-focus**: Monto enfocado automáticamente
- **No recargas**: Cards dinámicas sin page refresh
- **Offline-ready**: Errores manejados gracefully
- **Mobile optimizado**: Inputs, botones y flujo táctil

## 🚀 Comandos de Desarrollo

```bash
# Desarrollo local
npm start
# → http://localhost:4200

# Desarrollo accesible en red local  
ng serve --host 0.0.0.0
# → http://[tu-ip]:4200 (desde móviles)

# Build optimizado
npm run build

# Linting y formato
npm run lint

# Testing (si configurado)
npm test
```

## 📱 Optimizaciones Mobile-First

### UX Táctil
- **Auto-focus**: Campo monto enfocado al entrar
- **Teclado numérico**: inputmode="decimal" 
- **Botones grandes**: Mínimo 44px touch target
- **Feedback inmediato**: Loading states y confirmaciones
- **Sin scroll**: Toda la acción en viewport

### Performance en Dispositivos Lentos
- **Chunk splitting**: Solo carga lo necesario
- **Lazy loading**: Rutas bajo demanda
- **Minimal JS**: Solo lo esencial para facturar
- **CSS optimizado**: TailwindCSS purged
- **Edge functions**: Procesamiento en servidor

### Conectividad Limitada
- **Error handling**: Mensajes claros de conectividad
- **Retry automático**: Botón reintentar siempre visible
- **Offline awareness**: Estados de red manejados
- **Timeout adecuados**: 30s para requests críticos

## 🔒 Seguridad y Compliance

### AFIP y Regulaciones
- **Estructura oficial**: Según documentación TusFacturas
- **Validaciones**: Monto, fecha, CAE obligatorios
- **Solo CAE válidos**: No se guardan facturas fallidas
- **Trazabilidad**: Logs en Edge Functions

### Datos Sensibles
- **Tokens en ENV**: Variables de entorno en Edge Functions
- **JWT Auth**: Supabase maneja autenticación
- **RLS policies**: Row Level Security en DB
- **HTTPS only**: Todas las comunicaciones cifradas

### Backup y Recuperación
- **Supabase**: Backup automático incluido
- **PDFs duplicados**: TusFacturas + Storage propio
- **Configuración**: Centralizada y respaldada
- **Auditabilidad**: created_at en todas las tablas

## 📊 Monitoreo y Analytics

### Logs de Edge Functions
```javascript
// tf-proxy logs
console.log('🌐 Proxying request to TusFacturas')
console.log('📤 Request body keys:', Object.keys(requestBody))
console.log('📥 Response status:', resp.status)

// pdf-proxy logs  
console.log('📄 PDF fetched successfully:', arrayBuffer.byteLength, 'bytes')
```

### Métricas de Usuario
- **Totales component**: Estadísticas en tiempo real
- **Performance**: Tiempo de emisión de facturas
- **Errores**: Tasa de error y tipos más comunes
- **Uso**: Facturas por día/mes/año

## ⚡ Estados y Feedback Visual

### 🟢 Estados de Éxito
```typescript
// Card verde con información completa
{
  estado: 'success',
  factura: {
    tipo: 'FC',
    numero: 20,
    total: 500.00,
    cae: '74001234567890',
    fecha: '2025-08-17'
  }
}

// Acciones disponibles:
- Ver PDF → Abre en nueva pestaña
- Compartir → Web Share API o clipboard  
- Imprimir → Menu de impresión nativo
- Volver → Limpia form y enfoca monto
```

### 🔴 Estados de Error
```typescript
// Card roja con mensaje específico
{
  estado: 'error',
  error: 'Error específico de la API',
  mensajeError: 'El monto debe ser mayor a 0'
}

// Acciones de recuperación:
- Reintentar → Mismo request
- Volver → Limpiar formulario
```

### ⏳ Estados de Carga
```typescript
// Durante emisión
{
  estado: 'loading',
  mensaje: 'Emitiendo factura...'
}

// UI bloqueada, spinner visible
// Timeout de 30 segundos máximo
```

## 🧪 Testing y Validación

### Casos de Prueba Críticos
```bash
✅ Facturación exitosa con monto válido
✅ Error de monto inválido (0, negativo, >2 decimales)
✅ Error de configuración faltante
✅ Error de conectividad con TusFacturas
✅ Descarga y almacenamiento de PDF
✅ Compartir factura en móvil
✅ Imprimir factura en diferentes navegadores
✅ Volver y continuar facturando sin recargar
```

### Validaciones de Datos
```typescript
// Monto
- Requerido: ✅
- Mayor a 0: ✅  
- Máximo 2 decimales: ✅
- Separador decimal punto: ✅
- Máximo $999,999.99: ✅

// Fecha
- Formato YYYY-MM-DD: ✅
- No futuro: ✅
- No más de 30 días atrás: ✅

// Configuración
- CUIT válido: ✅
- Tokens no vacíos: ✅
- Punto de venta numérico: ✅
```

## 🔧 Troubleshooting

### Problemas Comunes

**❌ "Error obteniendo configuración"**
```
Causa: Tabla configuracion vacía o malformada
Solución: Completar /configuracion con todos los campos
```

**❌ "TusFacturas no responde"**
```
Causa: API offline o tokens inválidos  
Solución: Verificar tokens en configuración
```

**❌ "Error guardando PDF en Storage"**
```
Causa: Bucket facturas-pdf no existe o sin permisos
Solución: Verificar bucket y policies en Supabase
```

**❌ "Factura emitida pero no se guarda en DB"**
```
Causa: Error en estructura de datos o RLS policies
Solución: Revisar tipos y permisos en Supabase
```

### Logs Útiles para Debug
```bash
# Browser DevTools Console
🌐 Proxying request to TusFacturas
📤 Request body keys: ['fecha', 'tipo', 'moneda', ...]
📥 Response status: 200
📄 PDF fetched successfully: 45678 bytes

# Supabase Edge Functions Logs
[tf-proxy] Validating comprobante structure
[pdf-proxy] Downloading PDF from TusFacturas
[Storage] Uploading to facturas-pdf/2025/08/17/
```

## 🎯 Próximos Pasos y Roadmap

### Mejoras Planificadas
- [ ] **Notas de Crédito**: Formulario de emisión desde UI
- [ ] **Clientes frecuentes**: Cache de datos de clientes
- [ ] **Backup automático**: Sync con Google Drive/Dropbox
- [ ] **Multi-empresa**: Soporte para múltiples CUIT
- [ ] **Dashboard analytics**: Métricas avanzadas
- [ ] **PWA**: Instalable como app nativa
- [ ] **Offline mode**: Facturas en cola para sincronizar

### Configuraciones Adicionales
- [ ] **Mostrar PDF automático**: Setting en configuración
- [ ] **Sonidos de confirmación**: Feedback auditivo
- [ ] **Tema oscuro**: Dark mode toggle
- [ ] **Formato de número**: Configuración regional
- [ ] **Backup período**: Frecuencia de respaldos

---

## 🏁 Conclusión

FACTOS Angular es un sistema completo y robusto de facturación electrónica, optimizado para:

- ⚡ **Velocidad**: Mobile-first, sin recargas, auto-focus
- 🔒 **Confiabilidad**: Solo facturas con CAE válido, tipado estricto  
- 📱 **Movilidad**: Diseño táctil, conectividad limitada manejada
- 🎯 **Simplicidad**: Solo monto + fecha, flujo directo
- 🔧 **Mantenibilidad**: Angular 20, Supabase, documentación completa

**Sistema listo para producción** con todas las funcionalidades críticas implementadas y documentadas.
# Desarrollo local
npm start
# → http://localhost:4200

# Desarrollo accesible en red local  
ng serve --host 0.0.0.0
# → http://[tu-ip]:4200 (desde móviles)

# Build optimizado
npm run build

# Linting y formato
npm run lint

# Testing (si configurado)
npm test
```

## 📱 Optimizaciones Mobile-First

### UX Táctil
- **Auto-focus**: Campo monto enfocado al entrar
- **Teclado numérico**: inputmode="decimal" 
- **Botones grandes**: Mínimo 44px touch target
- **Feedback inmediato**: Loading states y confirmaciones
- **Sin scroll**: Toda la acción en viewport

### Performance en Dispositivos Lentos
- **Chunk splitting**: Solo carga lo necesario
- **Lazy loading**: Rutas bajo demanda
- **Minimal JS**: Solo lo esencial para facturar
- **CSS optimizado**: TailwindCSS purged
- **Edge functions**: Procesamiento en servidor

### Conectividad Limitada
- **Error handling**: Mensajes claros de conectividad
- **Retry automático**: Botón reintentar siempre visible
- **Offline awareness**: Estados de red manejados
- **Timeout adecuados**: 30s para requests críticos

## 🔒 Seguridad y Compliance

### AFIP y Regulaciones
- **Estructura oficial**: Según documentación TusFacturas
- **Validaciones**: Monto, fecha, CAE obligatorios
- **Solo CAE válidos**: No se guardan facturas fallidas
- **Trazabilidad**: Logs en Edge Functions

### Datos Sensibles
- **Tokens en ENV**: Variables de entorno en Edge Functions
- **JWT Auth**: Supabase maneja autenticación
- **RLS policies**: Row Level Security en DB
- **HTTPS only**: Todas las comunicaciones cifradas

### Backup y Recuperación
- **Supabase**: Backup automático incluido
- **PDFs duplicados**: TusFacturas + Storage propio
- **Configuración**: Centralizada y respaldada
- **Auditabilidad**: created_at en todas las tablas

## 📊 Monitoreo y Analytics

### Logs de Edge Functions
```javascript
// tf-proxy logs
console.log('🌐 Proxying request to TusFacturas')
console.log('📤 Request body keys:', Object.keys(requestBody))
console.log('📥 Response status:', resp.status)

// pdf-proxy logs  
console.log('📄 PDF fetched successfully:', arrayBuffer.byteLength, 'bytes')
```

### Métricas de Usuario
- **Totales component**: Estadísticas en tiempo real
- **Performance**: Tiempo de emisión de facturas
- **Errores**: Tasa de error y tipos más comunes
- **Uso**: Facturas por día/mes/año

## ⚡ Estados y Feedback Visual

- Loading states durante operaciones
- Mensajes de éxito/error detallados
- Indicadores visuales de conectividad
- Auto-limpieza de mensajes temporales

## 🎨 UI/UX

- Interfaz limpia y profesional
- Colores consistentes (azul primario, verde éxito, rojo error)
- Iconografía clara con SVG
- Transiciones suaves
- Accesibilidad considerada

---

**¡El sistema está listo para producción!** 

Solo necesitas:
1. Configurar las credenciales reales de TusFacturas
2. Ajustar los conceptos de facturación según tu negocio
3. Personalizar los estilos según tu marca
4. Configurar el entorno de producción

##  Historial de Desarrollo

### Sesi�n de Desarrollo - 16 Agosto 2025

####  **Implementaciones Completadas:**

1. **Componente Totales** (100% nuevo)
   - Estad�sticas por per�odos (hoy, ayer, mes actual/anterior)
   - Gr�ficos de barras comparativos
   - M�tricas avanzadas (mejor d�a, ticket promedio)
   - Resumen anual con proyecciones
   - Datos simulados para demostraci�n

2. **TusFacturasService** (servicio completo)
   - Autenticaci�n HTTP Basic con TusFacturas API
   - Emisi�n de facturas para consumidor final
   - Descarga de PDFs desde TusFacturas
   - Listado de comprobantes con filtros
   - Configuraci�n autom�tica de empresa
   - Manejo robusto de errores

3. **Componente Configuraci�n** (completamente renovado)
   - Formulario reactivo para credenciales TusFacturas
   - Verificaci�n de conexi�n en tiempo real
   - Sincronizaci�n autom�tica de datos empresariales
   - Estados visuales de conectividad
   - Validaciones completas

4. **Componente Facturar** (integraci�n real)
   - Integraci�n directa con TusFacturas API
   - Emisi�n real de facturas electr�nicas
   - Manejo de respuestas CAE y errores AFIP
   - Auto-focus optimizado para flujo r�pido
   - Feedback detallado de operaciones

5. **Arquitectura Angular 20**
   - Standalone components modernos
   - Signals para estado reactivo
   - Control flow syntax (@if, @for)
   - HttpClient configurado
   - Lazy loading de rutas
   - TypeScript strict mode

####  **Configuraciones T�cnicas:**

- **TailwindCSS v4**: Configuraci�n optimizada con PostCSS
- **HttpClient**: Provisto en app.config.ts con interceptors
- **Formularios Reactivos**: Validaciones en tiempo real
- **Manejo de Estado**: Signals para reactividad
- **Routing**: Lazy loading por features

####  **Optimizaciones UX:**

- Auto-focus en campos cr�ticos
- Feedback visual inmediato
- Estados de loading informativos
- Mensajes de error detallados
- Dise�o mobile-first
- Accesibilidad considerada

####  **Decisiones de Arquitectura:**

1. **Separaci�n por Features**: Cada funcionalidad en su propia carpeta
2. **Servicios Singleton**: Core services en carpeta dedicada
3. **Componentes Standalone**: Sin NgModules, m�s moderno
4. **Signals sobre RxJS**: Para estado local y reactividad simple
5. **TailwindCSS**: Para desarrollo r�pido y consistencia visual

---

###  **Estado del Proyecto:**

-  **Completamente funcional** para producci�n
-  **Integraci�n real** con TusFacturas API
-  **Optimizado** para dispositivos m�viles
-  **Documentaci�n completa** incluida
-  **Pendiente**: Configurar credenciales reales de producci�n

