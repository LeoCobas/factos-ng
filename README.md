# FACTOS-NG

Sistema de **facturación electrónica rápida** desarrollado en Angular 20 con Supabase, optimizado para **consumidor final** en Argentina via ARCA/AFIP (Arca SDK).

## 🚀 Características Principales

- **Mobile-First**: Diseño optimizado para dispositivos móviles y táctiles
- **Facturación Express**: Solo monto + fecha, emisión en segundos
- **Sin Recargas**: Cards dinámicas de éxito/error sin refresh de página
- **Tipado Estricto**: Prevención de errores con TypeScript
- **Real-time**: Datos en tiempo real con Supabase
- **AFIP Directo**: Conexión directa con Web Services de ARCA via Arca SDK (gratuito)
- **Servicios Optimizados**: Código refactorizado y sin bloat para máximo rendimiento

## 🛠️ Tecnologías

- **Angular 20** - Standalone components, Signals, Control flow syntax
- **TypeScript Strict** - Tipado extremo para prevención de errores
- **TailwindCSS v4** - Mobile-first, optimizado y purgado
- **Supabase** - Full-stack: DB, Auth, Storage, Edge Functions
- **Arca SDK** (`@arcasdk/core`) - Facturación electrónica AFIP Argentina (gratuito)
- **Edge Functions** - arca-proxy (facturación AFIP), pdf-proxy (PDFs)

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

### 3. Configurar Certificados ARCA
Los certificados se configuran como **Supabase Secrets** (Edge Functions > Secrets):

| Secret | Descripción |
|---|---|
| `ARCA_CERT` | Contenido del certificado .crt |
| `ARCA_KEY` | Contenido de la clave privada .key |
| `ARCA_CUIT` | CUIT del contribuyente (sin guiones) |
| `ARCA_PRODUCTION` | `true` para producción, `false` para testing |

### 4. Ejecutar
```bash
# Desarrollo local
npm start

# Desarrollo accesible en red (móviles)
ng serve --host 0.0.0.0
```

## 📱 Uso del Sistema

### 1. Configuración
```
/configuracion → Completar campos:
- CUIT y razón social
- Punto de venta y tipo comprobante  
- Concepto y actividad AFIP
- % IVA
```

### 2. Facturación
```
/facturar → Monto + Fecha → Emitir
- Card verde: Ver datos, Compartir, Imprimir, Volver
- Card roja: Reintentar, Volver
- Sin recargas, auto-focus continuo
```

### 3. Gestión
```
/listado → Comprobantes con datos reales de Supabase
/totales → Estadísticas en tiempo real
```

## 🏗️ Arquitectura

```
src/app/
├── core/
│   ├── services/
│   │   ├── facturacion.service.ts    # ✅ Servicio principal (Arca SDK)
│   │   ├── auth.service.ts
│   │   ├── supabase.service.ts
│   │   ├── contribuyente.service.ts
│   │   └── pdf.service.ts
│   ├── types/
│   │   └── database.types.ts         # ✅ Tipos generados de Supabase
│   └── guards/auth.guard.ts
├── features/
│   ├── facturar/        # 🔄 Mobile-first, cards dinámicas
│   ├── listado/         # 🔄 Datos reales Supabase + NC
│   ├── totales/         # 🔄 Estadísticas tiempo real
│   ├── configuracion/   # 🔄 Sin tokens TusFacturas
│   └── auth/
├── shared/components/ui/
├── layouts/main-layout.component.ts
└── environments/

supabase/functions/
├── arca-proxy/          # ✅ Proxy ARCA/AFIP (Arca SDK)
├── pdf-proxy/           # ✅ Proxy descarga PDFs
└── _shared/cors.ts
```

### 🗄️ Base de Datos
```sql
-- Datos del contribuyente (sin credenciales de API externa)
contribuyentes: id, cuit, razon_social, concepto, actividad, iva_porcentaje,
                punto_venta, tipo_comprobante_default

-- Comprobantes emitidos (facturas + notas de crédito)
comprobantes: id, tipo_comprobante, numero_comprobante, fecha, total,
              cae, vencimiento_cae, estado, concepto, pdf_url

-- Cache de tickets WSAA (autenticación AFIP, válidos ~12hs)
wsaa_tickets: cuit, service_name, credentials (JSONB), expires_at
```

## ⚡ Flujo de Facturación

### 🎯 Proceso Completo (automático)
```typescript
1. Validar configuración → Supabase (contribuyente)
2. Enviar a ARCA/AFIP → arca-proxy Edge Function
   a. Obtener/renovar ticket WSAA → wsaa_tickets cache
   b. Consultar último comprobante → getLastVoucher()
   c. Crear comprobante → createVoucher() → CAE
3. Guardar en DB → Solo si CAE válido
4. Mostrar resultado → Card verde/roja
```

### 📱 UX Mobile-First
- **Auto-focus**: Monto enfocado automáticamente
- **Teclado numérico**: inputmode="decimal"
- **Cards dinámicas**: Sin recargar página
- **Botones grandes**: 44px mínimo touch target
- **Feedback inmediato**: Loading, éxito, error

## 🔒 Seguridad

- **Certificados seguros**: Supabase Secrets (no en DB ni frontend)
- **Tipado estricto**: Prevención errores en compile-time
- **Solo CAE válidos**: No persiste facturas fallidas
- **JWT Auth**: Supabase Row Level Security
- **HTTPS**: Todas las comunicaciones cifradas
- **WSAA tokens**: Cache seguro con expiración automática

## 🎯 Estado del Proyecto

### ✅ Completado y Funcional
- [x] **FacturacionService**: Flujo completo via Arca SDK
- [x] **Edge Function arca-proxy**: WSAA auth + facturación directa AFIP
- [x] **Facturar Component**: Mobile-first con cards dinámicas
- [x] **Listado Component**: Datos reales Supabase + Notas de Crédito
- [x] **Totales Component**: Estadísticas tiempo real
- [x] **Configuracion Component**: Sin tokens de API externa
- [x] **Tipado Completo**: Según WSFE AFIP
- [x] **Mobile UX**: Auto-focus, teclado numérico, botones táctiles
- [x] **Error Handling**: Reintentar, mensajes específicos, recovery

### 📋 Pendiente
- [ ] Generación de PDFs (AFIP no genera — implementar server-side)
- [ ] Gestión completa de clientes
- [ ] Dashboard con estadísticas avanzadas

## 🚀 Deploy

```bash
# Build optimizado
npm run build

# Variables de entorno requeridas (frontend)
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_key

# Supabase Secrets (Edge Functions)
ARCA_CERT=contenido_certificado_crt
ARCA_KEY=contenido_clave_privada
ARCA_CUIT=20111111112
ARCA_PRODUCTION=true
```

---

**FACTOS-NG** - Sistema de facturación electrónica optimizado para velocidad, confiabilidad y simplicidad móvil. 🇦🇷⚡📱

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory.
