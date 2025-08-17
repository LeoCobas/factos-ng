# FACTOS-NG

Sistema de facturación desarrollado en Angular 20 con Supabase como backend.

## Tecnologías

- **Angular 20** - Framework frontend con standalone components
- **TypeScript** - Lenguaje de programación tipado
- **TailwindCSS** - Framework de estilos utilitarios
- **Angular CDK** - Biblioteca de componentes de desarrollo
- **Supabase** - Backend as a Service (base de datos y autenticación)
- **Signals** - Sistema de reactividad nativo de Angular

## Configuración inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Actualizar las credenciales en `src/environments/environment.ts`

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

## Arquitectura

- **Standalone Components**: No se usan NgModules
- **Signals**: Para gestión de estado reactivo
- **Lazy Loading**: Carga diferida de rutas
- **Reactive Forms**: Formularios reactivos
- **Control de flujo nativo**: `@if`, `@for`, `@switch`

## Estado del proyecto

### ✅ Implementado
- [x] Estructura base del proyecto
- [x] Configuración de TailwindCSS
- [x] Sistema de autenticación con Supabase
- [x] Guards de protección de rutas
- [x] Componentes UI básicos (Button, Input, Card)
- [x] Layout principal con navegación
- [x] Rutas lazy loading configuradas

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
