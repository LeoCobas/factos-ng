# FACTOS-NG

Sistema de **facturación electrónica rápida** desarrollado en Angular 20 con Supabase, optimizado para **consumidor final** en Argentina via TusFacturas.app.

## 🚀 Características Principales

- **Mobile-First**: Diseño optimizado para dispositivos móviles y táctiles
- **Facturación Express**: Solo monto + fecha, emisión en segundos
- **Sin Recargas**: Cards dinámicas de éxito/error sin refresh de página
- **Tipado Estricto**: Prevención de errores con TypeScript según API TusFacturas
- **Real-time**: Datos en tiempo real con Supabase
- **PDF Management**: Descarga, almacenamiento y gestión automática de PDFs
- **Servicios Optimizados**: Código refactorizado y sin bloat para máximo rendimiento

## 🛠️ Tecnologías

- **Angular 20** - Standalone components, Signals, Control flow syntax
- **TypeScript Strict** - Tipado extremo para prevención de errores
- **TailwindCSS v4** - Mobile-first, optimizado y purgado
- **Supabase** - Full-stack: DB, Auth, Storage, Edge Functions
- **TusFacturas API** - Facturación electrónica AFIP Argentina
- **Edge Functions** - tf-proxy, pdf-proxy para seguridad

## ⚡ Instalación Rápida

### 1. Clonar e instalar
```bash
git clone https://github.com/LeoCobas/factos-ng.git
cd factos-ng
npm install
```

### 2. Configurar Supabase
```bash
# Copiar variables de entorno
cp src/environments/environment.ts src/environments/environment.local.ts

# Actualizar credenciales en environment.local.ts
export const environment = {
  supabase: {
    url: 'tu_supabase_url',
    anonKey: 'tu_anon_key'
  }
};
```

### 3. Ejecutar
```bash
# Desarrollo local
npm start

# Desarrollo accesible en red (móviles)
ng serve --host 0.0.0.0
```

## 📱 Uso del Sistema

### 1. Configuración
```
/configuracion → Completar TODOS los campos:
- CUIT y razón social
- Punto de venta y tipo comprobante  
- Concepto y actividad AFIP
- % IVA y tokens TusFacturas
```

### 2. Facturación
```
/facturar → Monto + Fecha → Emitir
- Card verde: Ver PDF, Compartir, Imprimir, Volver
- Card roja: Reintentar, Volver
- Sin recargas, auto-focus continuo
```

### 3. Gestión
```
/listado → Facturas con datos reales de Supabase
/totales → Estadísticas en tiempo real
```

## 🏗️ Arquitectura

```
src/app/
├── core/
│   ├── services/
│   │   ├── facturacion.service.ts    # ✅ Servicio principal
│   │   ├── auth.service.ts
│   │   ├── supabase.service.ts
│   │   └── pdf.service.ts
│   ├── types/
│   │   └── database.types.ts         # ✅ Tipos generados de Supabase
│   └── guards/auth.guard.ts
├── features/
│   ├── facturar/        # 🔄 Mobile-first, cards dinámicas
│   ├── listado/         # 🔄 Datos reales Supabase + NC
│   ├── totales/         # 🔄 Estadísticas tiempo real
│   ├── configuracion/   # 🔄 React parity completo
│   └── auth/
├── shared/components/ui/
├── layouts/main-layout.component.ts
└── environments/

supabase/functions/
├── tf-proxy/            # ✅ Proxy TusFacturas API
├── pdf-proxy/           # ✅ Proxy descarga PDFs
└── _shared/cors.ts
```

### 🗄️ Base de Datos
```sql
-- Solo facturas con CAE válido
facturas: id, numero, fecha, tipo_comprobante, total, cae, punto_venta, pdf_url, tf_id

-- Configuración centralizada  
configuracion: cuit, razon_social, punto_venta, iva_porcentaje, api_tokens

-- Storage organizado
facturas-pdf/
├── 2025/08/17/FC_0004_00000020.pdf
└── notas_credito/...
```

## ⚡ Flujo de Facturación

### 🎯 Proceso Completo (automático)
```typescript
1. Validar configuración → Supabase
2. Construir comprobante → Según API TusFacturas  
3. Enviar a AFIP → tf-proxy Edge Function
4. Guardar en DB → Solo si CAE válido
5. Descargar PDF → pdf-proxy + Storage
6. Mostrar resultado → Card verde/roja
```

### 📱 UX Mobile-First
- **Auto-focus**: Monto enfocado automáticamente
- **Teclado numérico**: inputmode="decimal"
- **Cards dinámicas**: Sin recargar página
- **Botones grandes**: 44px mínimo touch target
- **Feedback inmediato**: Loading, éxito, error

## 🔒 Seguridad

- **Tokens seguros**: Variables ENV en Edge Functions
- **Tipado estricto**: Prevención errores en compile-time
- **Solo CAE válidos**: No persiste facturas fallidas
- **JWT Auth**: Supabase Row Level Security
- **HTTPS**: Todas las comunicaciones cifradas

## 🧪 Testing

### Casos Críticos Validados
- ✅ Facturación exitosa + PDF storage
- ✅ Validación monto (decimales, límites)
- ✅ Manejo errores TusFacturas offline
- ✅ Cards dinámicas sin recargas
- ✅ Compartir/Imprimir en móviles
- ✅ Configuración completa React parity

## 📊 Performance

```bash
# Chunks optimizados
facturar-component: 38.81 kB  # Todo incluido
configuracion-component: 42.78 kB
totales-component: 24.14 kB
listado-component: 19.56 kB

# Tiempo de facturación típico
Validación + TusFacturas + Storage: ~3-5 segundos
```

## 🎯 Estado del Proyecto

### ✅ Completado y Funcional
- [x] **FacturacionService**: Flujo completo de emisión con Edge Functions
- [x] **Facturar Component**: Mobile-first con cards dinámicas éxito/error  
- [x] **Listado Component**: Datos reales Supabase + soporte Notas de Crédito
- [x] **Totales Component**: Estadísticas tiempo real con comparaciones
- [x] **Configuracion Component**: React parity, todos los campos
- [x] **PDF Management**: Storage organizado en facturas-pdf bucket
- [x] **Tipado Completo**: Según documentación oficial TusFacturas
- [x] **Edge Functions**: tf-proxy, pdf-proxy activos y validados
- [x] **Mobile UX**: Auto-focus, teclado numérico, botones táctiles
- [x] **Error Handling**: Reintentar, mensajes específicos, recovery

### 📋 Funcionalidades Implementadas
- **Facturación síncrona**: Emite directamente a AFIP, no borradores
- **Solo consumidor final**: Flujo simplificado sin verificar CUIT
- **Validaciones estrictas**: Máximo 2 decimales, estructura API
- **Storage organizado**: YYYY/MM/DD/FC_PPPP_NNNNNNNN.pdf
- **Real-time data**: Supabase subscriptions para datos actualizados
- **Cards de respuesta**: Verde (4 botones) / Roja (2 botones)
- **Sin recargas**: Volver enfoca monto para facturación continua

## 🏁 Listo para Producción

**Sistema completo** con todas las funcionalidades críticas:
- ⚡ Velocidad optimizada para dispositivos lentos
- 🔒 Confiabilidad con solo facturas CAE válido
- 📱 UX mobile-first y táctil  
- 🎯 Simplicidad extrema (monto + fecha)
- 🔧 Mantenimiento con documentación completa


## 📝 Refactorización y simplificación de PdfService (agosto 2025)

- Se redujo el tamaño del servicio de 370 a 258 líneas (-30%)
- Se eliminaron métodos y helpers no utilizados (`openPdf`, `downloadPdfBlobDirect`, `PdfShareOptions`)
- Se centralizó la creación de `PdfInfo` con `createPdfInfo()`
- Se eliminaron duplicados de lógica de descarga y helpers en los componentes
- Se mantuvieron todos los fallbacks y compatibilidad multiplataforma
- Los componentes ahora usan sólo `sharePdf`, `downloadPdf` y `createPdfInfo`

**Resultado:** código más limpio, mantenible y fácil de extender, sin perder funcionalidad.

## 🔧 Optimización del FacturacionService (agosto 2025)

- Se redujo el tamaño del servicio de 515+ líneas a 468 líneas (-10% aproximadamente)
- **Eliminado logging excesivo**: Se removieron 30+ console.log/console.error no necesarios
- **Nuevo tipado TypeScript**: Se agregaron interfaces `TusFacturasResponse`, `FacturaResult`, `NotaCreditoResult`
- **Método extraído**: `getValidatedConfig()` centraliza validación de configuración
- **Simplificación de métodos**: `crearNotaCredito()` y `emitirFactura()` sin debug logging
- **Mejor tipado de respuestas**: Interfaces específicas para respuestas de TusFacturas API
- **Código más limpio**: Menos duplicación, mejor estructura, mantenimiento simplificado

**Resultado:** servicio más eficiente, mejor tipado, sin logging innecesario y más fácil de mantener.

---
## 📚 Documentación

- **[GUIA-SISTEMA-COMPLETO.md](./GUIA-SISTEMA-COMPLETO.md)**: Documentación técnica detallada
- **Código comentado**: Todos los servicios incluyen documentación inline
- **Tipos TypeScript**: Documentados según API oficial
- **Troubleshooting**: Errores comunes y soluciones

## 🚀 Deploy

```bash
# Build optimizado
npm run build

# Variables de entorno requeridas
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_key

# Edge Functions con tokens TusFacturas
TF_APITOKEN=tu_token
TF_APIKEY=tu_key  
TF_USERTOKEN=tu_user_token
```

---

**FACTOS-NG** - Sistema de facturación electrónica optimizado para velocidad, confiabilidad y simplicidad móvil. 🇦🇷⚡📱

### 🚧 Próximos pasos
- [ ] Gestión completa de clientes
- [ ] Sistema de facturación
- [ ] Integración con TusFacturas API
- [ ] Generación de PDFs
- [ ] Dashboard con estadísticas

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
