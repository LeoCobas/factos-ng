# Factos - Sistema de Facturación Electrónica para Argentina

Sistema completo de facturación electrónica para Argentina que se integra con la API de [TusFacturas.app](https://developers.tusfacturas.app/) para emitir comprobantes electrónicos válidos ante AFIP/ARCA.

## 🚀 Características Principales

### ✅ **Facturación Electrónica AFIP**
- **Factura B**: Para Responsables Inscriptos
- **Factura C**: Para Monotributistas
- **Notas de Crédito B y C**: Anulación de comprobantes
- **Consumidor Final**: Configuración automática para CF
- **Validación AFIP/ARCA**: Comprobantes oficiales con CAE

### ✅ **Gestión Completa de PDFs**
- **Almacenamiento Permanente**: PDFs guardados en Supabase Storage
- **URLs Temporales**: Manejo automático de URLs de 7 días de TusFacturas
- **Regeneración Automática**: Re-obtención de PDFs expirados
- **Visualización Embebida**: PDFs mostrados directamente en la app
- **Descarga y Compartir**: Funcionalidades completas de PDF

### ✅ **Interfaz Moderna y Responsive**
- **Diseño Mobile-First**: Optimizado para dispositivos móviles
- **Teclado Numérico**: Activación automática en móviles
- **Navegación Intuitiva**: 4 secciones principales bien definidas
- **Componentes shadcn/ui**: UI moderna y accesible

### ✅ **Integración Completa**
- **TusFacturas.app API**: Integración completa con endpoints oficiales
- **Supabase Backend**: Base de datos PostgreSQL + Storage
- **Netlify Functions**: Proxies para evitar CORS
- **Variables de Entorno**: Configuración segura

## 🛠️ Stack Tecnológico

### **Frontend**
- **React 18** + **TypeScript** + **Vite**
- **shadcn/ui** + **Tailwind CSS**
- **React Hook Form** + **Zod** (validación)
- **date-fns** (manipulación de fechas)
- **Lucide React** (iconos)

### **Backend & APIs**
- **Supabase**: PostgreSQL + Storage + Auth + Edge Functions
- **TusFacturas.app API**: Facturación electrónica AFIP
- **Supabase Edge Functions**: Proxies para APIs externas (tf-proxy, pdf-proxy)

### **Deployment**
- **Netlify**: Hosting y serverless functions
- **Supabase**: Base de datos y storage en la nube

## 📋 Requisitos Previos

### **1. Cuenta en TusFacturas.app**
- Registrarse en [www.tusfacturas.app](https://www.tusfacturas.app/)
- Ir a **API** en el menú lateral
- Obtener credenciales de API:
  - **API Key**: Número de 5 dígitos (ej: 68461)
  - **API Token**: 32 caracteres alfanuméricos
  - **User Token**: 64 caracteres alfanuméricos
  - **Webhook Token**: 64 caracteres alfanuméricos (opcional)
- Configurar datos fiscales en el panel

### **2. Proyecto Supabase**
- Crear proyecto en [supabase.com](https://supabase.com/)
- Ejecutar migraciones SQL incluidas
- Configurar bucket de storage

### **3. Node.js**
- Versión 18 o superior
- npm o bun como package manager

## ⚙️ Instalación y Configuración

### **1. Clonar y Configurar**
```bash
git clone <tu-repositorio>
cd factos
npm install
```

### **2. Variables de Entorno**
Crear archivo `.env.local`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima
```

### **3. Base de Datos**
```bash
# Ejecutar migraciones en Supabase SQL Editor
# Los archivos están en supabase/migrations/
```

### **4. Desarrollo Local**
```bash
npm run dev
# Con Supabase CLI (para funciones Edge)
npx supabase start
npx supabase functions serve
```

## 🔧 Configuración de la Aplicación

### **Sección Configuración**

#### **Datos de Facturación**
- **Concepto a facturar**: Descripción del producto/servicio
- **IVA**: Selección entre 21% o 10.5%
- **Tipo de Comprobante**: Factura B (RI) o Factura C (Monotributista)

#### **Datos del Negocio**
- **Punto de Venta**: 2 dígitos numéricos
- **CUIT**: 11 dígitos (solo números)
- **Razón Social**: Nombre de la empresa

#### **Datos API**
- **API Token**: Valor alfanumérico de TusFacturas
- **API Key**: Valor numérico de TusFacturas
- **User Token**: Valor alfanumérico de TusFacturas

## 📖 Guía de Uso

### **1. Facturar - Emisión de Comprobantes**

#### **Flujo Principal**
1. **Ingresar monto**: Solo el monto total (IVA incluido)
2. **Fecha automática**: Hoy por defecto, editable
3. **Emisión**: Comunicación automática con AFIP
4. **Resultado**: PDF + datos del comprobante

#### **Características Especiales**
- **Foco automático** en campo monto
- **Teclado numérico** en dispositivos móviles
- **Validación en tiempo real**
- **Manejo de errores** con mensajes claros

#### **Post-Emisión**
- **PDF embebido** en la aplicación
- **Botones de acción**: Guardar, Compartir, Imprimir, Volver
- **Almacenamiento automático** en Supabase Storage
- **URL permanente** guardada en base de datos

### **2. Listado - Gestión de Facturas**

#### **Vista Principal**
- **Listado diario** por defecto
- **Selector de fecha** con calendario
- **Información completa**: Número, fecha, monto, estado
- **Datos AFIP**: CAE, tipo de comprobante

#### **Acciones por Factura**
- **Click en factura**: Ver PDF directamente
- **Nota de Crédito**: Anulación con confirmación de 3s
- **Ver PDF**: Regeneración automática si expiró
- **Ver Detalles**: Información completa

#### **Notas de Crédito**
- **Confirmación obligatoria** con delay de 3 segundos
- **Emisión automática** via API
- **PDF de NC** mostrado inmediatamente
- **Estado actualizado** a "anulada"

### **3. Totales - Estadísticas**

#### **Períodos Mostrados**
- **Hoy**: Total del día actual
- **Ayer**: Total del día anterior
- **Mes Actual**: Total del mes en curso
- **Mes Anterior**: Total del mes previo

#### **Información Visual**
- **Fechas claras** entre paréntesis
- **Nombres de meses** para claridad
- **Totales formateados** en pesos argentinos

### **4. Configuración - Ajustes del Sistema**

#### **Gestión de Configuración**
- **Última configuración** siempre visible
- **Actualización automática** de valores existentes
- **Validación en tiempo real** de campos
- **Persistencia** en base de datos

## 🔄 Flujo de Datos y Storage

### **Manejo de PDFs**

#### **Estrategia Híbrida**
1. **URL Temporal**: TusFacturas (7 días)
2. **Storage Permanente**: Supabase Storage
3. **Regeneración**: API si expira
4. **Fallback**: URL original si falla storage

#### **Estructura de Archivos**
```
facturas-pdf/
├── facturas/
│   └── 2024/01/15/
│       └── 0001-00000001.pdf
└── notas_credito/
    └── 2024/01/15/
        └── 0001-00000002.pdf
```

#### **Logs de Debugging**
- 📥 Descarga desde TusFacturas
- 📤 Subida a Supabase Storage
- ✅ Éxito o ⚠️ Fallback
- 🔗 URLs generadas

### **Base de Datos**

#### **Tablas Principales**
- **configuracion**: Datos del negocio y API
- **facturas**: Comprobantes emitidos
- **notas_credito**: NC emitidas

#### **Campos Clave**
- **pdf_url**: URL permanente del PDF
- **pdf_expires_at**: Expiración de URL temporal
- **estado**: 'emitida' o 'anulada'
- **afip_id**: ID de AFIP para tracking

## 🚀 Deployment

### **Netlify (Frontend)**
1. **Connect repository** en Netlify
2. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (recomendado) o `VITE_SUPABASE_ANON_KEY` (legacy)

### **Supabase (Backend + Edge Functions)**
1. **Login en Supabase CLI**:
   ```bash
   npx supabase login
   ```

2. **Deploy Edge Functions como públicas**:
   ```bash
   # Opción A: Usar script automático
   ./deploy-functions.sh          # Linux/Mac
   deploy-functions.bat           # Windows
   
   # Opción B: Comandos manuales
   npx supabase functions deploy tf-proxy --no-verify-jwt
   npx supabase functions deploy pdf-proxy --no-verify-jwt
   ```

3. **Verificar configuración** en Supabase Dashboard:
   - Ir a **Settings > Edge Functions**
   - Confirmar que `tf-proxy` y `pdf-proxy` aparecen como **"No verification"**
   - Si no, cambiar manualmente **JWT verification** a "No verification"

4. **Configurar variables de entorno** en Supabase Dashboard:
   - Ir a **Settings > Edge Functions > Environment variables**
   - Agregar las siguientes variables:
     - `TF_APITOKEN`: API Token de TusFacturas (32 caracteres alfanuméricos)
     - `TF_APIKEY`: API Key de TusFacturas (numérico, ej: 68461)
     - `TF_USERTOKEN`: User Token de TusFacturas (64 caracteres alfanuméricos)
   - **Obtener credenciales**: Ir a [TusFacturas.app](https://www.tusfacturas.app) → API → Copiar credenciales

5. **Deploy migraciones**:
   ```bash
   npx supabase db push
   ```

### **Supabase Edge Functions**
- **tf-proxy**: Proxy para API de TusFacturas (evita CORS, inyecta credenciales)
- **pdf-proxy**: Proxy para PDFs (evita X-Frame-Options, permite embebido)

### **Supabase**
- **Database**: Migraciones automáticas
- **Storage**: Bucket `facturas-pdf` público
- **RLS**: Políticas permisivas para desarrollo

## 🔧 Desarrollo

### **Estructura del Proyecto**
```
src/
├── components/          # Componentes React
│   ├── ui/             # shadcn/ui components
│   ├── Facturar.tsx    # Emisión de facturas
│   ├── Listado.tsx     # Gestión de facturas
│   ├── Totales.tsx     # Estadísticas
│   ├── Configuracion.tsx # Configuración
│   └── PDFViewer.tsx   # Visor de PDFs
├── services/           # Servicios externos
│   └── tusfacturas-api.ts # API de TusFacturas
├── integrations/       # Integraciones
│   └── supabase/       # Cliente y tipos
├── lib/               # Utilidades
│   └── utils.ts       # Funciones helper
└── App.tsx            # Componente principal

supabase/
├── functions/          # Edge Functions
│   ├── tf-proxy/      # Proxy para TusFacturas API
│   └── pdf-proxy/     # Proxy para PDFs
├── migrations/         # Migraciones de base de datos
└── config.toml        # Configuración de Supabase
```

### **Scripts Disponibles**
```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Linting
```

## 🐛 Troubleshooting

### **Errores Comunes**

#### **"supabaseUrl is required"**
- Verificar variables de entorno en Netlify
- Asegurar que `VITE_SUPABASE_URL` esté definida

#### **"Para la condición de IVA seleccionada no se permite realizar este tipo de comprobante"**
- Verificar tipo de comprobante vs CUIT
- Monotributista → Factura C
- Responsable Inscripto → Factura B

#### **PDF no se muestra embebido**
- Verificar función `pdf-proxy` en Supabase Edge Functions
- Revisar headers CORS
- Probar en modo incógnito
- Verificar URL de Supabase en variables de entorno

#### **Error 401 "Missing authorization header" en Edge Functions**
- **Opción 1 (Recomendada)**: Configurar desde Supabase Dashboard:
  1. Ir a **Settings > Edge Functions**
  2. Encontrar `tf-proxy` y `pdf-proxy`
  3. Cambiar **JWT verification** de "Required" a "No verification"
  4. Guardar cambios
- **Opción 2**: Usar Supabase CLI:
  1. `npx supabase login`
  2. `npx supabase functions deploy tf-proxy --no-verify-jwt`
  3. `npx supabase functions deploy pdf-proxy --no-verify-jwt`
- **Verificar**: Las funciones deben aparecer como "No verification" en el dashboard

#### **Storage no funciona**
- Verificar bucket `facturas-pdf` en Supabase
- Revisar políticas de storage
- Verificar logs en consola del navegador

### **Logs de Debugging**
- **Consola del navegador**: Logs detallados de todas las operaciones
- **Network tab**: Requests a APIs y storage
- **Supabase logs**: Errores de base de datos

## 📞 Soporte

### **Recursos Útiles**
- [Documentación TusFacturas.app](https://developers.tusfacturas.app/)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

### **Contacto**
- **Issues**: Crear issue en el repositorio
- **Documentación**: Este README y comentarios en código 

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo `LICENSE` para más detalles.

---

**Factos** - Simplificando la facturación electrónica en Argentina 🇦🇷
