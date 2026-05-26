# Contratos operativos de backend

## `arca-proxy`

### Precondiciones

- Requiere `POST /functions/v1/arca-proxy?action=...`.
- Requiere `Authorization: Bearer ...` con sesion Supabase valida.
- La verificacion ocurre dentro de la function, no en el gateway legacy de Edge Functions.
- Requiere contribuyente asociado al usuario autenticado.
- Requiere `arca_cert` y `arca_key` cargados.
- Requiere bucket `wsfe` dentro de `contribuyentes.arca_ticket`.

### Acciones soportadas

#### `action=crear-factura`

Request:

- `punto_venta: number`
- `tipo_comprobante: string`
- `monto: number`
- `fecha: string` en `YYYY-MM-DD`
- `concepto_afip: number`
- `iva_porcentaje: number`
- `doc_tipo: number`
- `doc_nro: number`
- `condicion_iva_receptor_id: number`

Response exitosa:

```json
{
  "success": true,
  "data": {
    "CAE": "string",
    "CAEFchVto": "string",
    "CbteDesde": 1,
    "CbteTipo": 11,
    "PtoVta": 4,
    "Resultado": "A"
  }
}
```

#### `action=crear-nota-credito`

Request adicional:

- `punto_venta_original?: number`
- `tipo_comprobante_original: string`
- `cbte_asociado_nro: number`
- `cbte_asociado_fecha: string` en `YYYYMMDD`
- `fecha?: string` en `YYYY-MM-DD`

Response:

- Mismo shape de salida que `crear-factura`.

#### `action=ultimo-comprobante`

Request:

- `punto_venta: number`
- `tipo_comprobante: string`

Response:

```json
{
  "success": true,
  "data": {
    "ultimo_comprobante": 123
  }
}
```

### Semantica de errores

- `400`: validacion local o accion invalida.
- `405`: metodo distinto de `POST`.
- `500`: error interno, credenciales faltantes, fallo de ARCA SDK o sesion invalida.
- Rechazo AFIP/ARCA: `success=false`, `error` legible y bloque `debug` con resumen de respuesta cruda.

### Dependencias operativas

- `@arcasdk/core@0.3.6`
- `contribuyentes.arca_ticket` para cachear credenciales WSAA
- `readArcaTicketBucket(..., 'wsfe')`
- `writeArcaTicketBucket(..., 'wsfe', ...)`

## `padron-lookup`

### Precondiciones

- Requiere `POST /functions/v1/padron-lookup`.
- Requiere `Authorization: Bearer ...` con sesion Supabase valida.
- La verificacion ocurre dentro de la function, no en el gateway legacy de Edge Functions.
- Si el usuario autenticado tiene un perfil en `contribuyentes` con `arca_cert` y `arca_key` configurados, se utiliza su certificado personal.
- **Modo Fallback**: Si el usuario no tiene un registro de contribuyente o sus certificados ARCA están vacíos, la función recurre a las credenciales de sistema (`SYSTEM_ARCA_CERT`, `SYSTEM_ARCA_KEY`, `SYSTEM_ARCA_CUIT`, `SYSTEM_ARCA_PRODUCTION`) leídas desde las variables de entorno de Deno.
- Si se usa el modo fallback, la función **no** intenta persistir los tickets WSAA generados. Si usa credenciales de contribuyente, persiste el ticket en el bucket `padron` de `contribuyentes.arca_ticket`.

### Request minimo

```json
{
  "cuit": "20123456789"
}
```

### Response normalizada

```json
{
  "success": true,
  "data": {
    "razon_social": "string",
    "domicilio": "string",
    "condicion_iva": "string",
    "fiscal_profile": "responsable-inscripto",
    "fiscal_status_message": "string",
    "fiscal_status_reliable": true,
    "fiscal_status_source": "constancia_inscripcion"
  }
}
```

### Semantica de errores

- `success=false` con mensaje operacional cuando falta perfil de contribuyente.
- `success=false` cuando faltan certificados o ARCA no devuelve datos.
- `504` cuando la consulta al padron vence por timeout.
- `success=false` con `"CUIT no encontrado"` cuando ARCA informa ausencia de persona.

### Lectura administrativa

- Si existe `SUPABASE_SERVICE_ROLE_KEY`, la funcion puede leer `contribuyentes` con un cliente administrativo.
- Si no existe, reutiliza el cliente autenticado del usuario.
- Esa elevacion es solo de lectura del perfil operativo, no del request del cliente.

## `FacturacionService`

### `emitirFactura(facturaData)`

Entrada:

- `monto`
- `fecha` en `DD/MM/YYYY`
- datos opcionales del receptor y perfil fiscal derivado

Comportamiento:

- valida contribuyente configurado
- valida fecha fiscal segun actividad
- valida que la fecha no sea anterior a la ultima autorizada del mismo tipo de comprobante y punto de venta
- resuelve tipo de comprobante
- obtiene o refresca access token de Supabase
- llama `arca-proxy?action=crear-factura`
- inserta el comprobante en `comprobantes`

Salida:

- `FacturaResult` con `success`, `comprobante` y `error`

### `crearNotaCredito(comprobanteId, numeroComprobante, monto)`

Comportamiento:

- lee el comprobante original
- deriva documento receptor y tipo de nota de credito
- valida que la fecha local de la nota no sea anterior a la ultima autorizada del mismo tipo y punto de venta
- llama `arca-proxy?action=crear-nota-credito`
- inserta la nota de credito
- actualiza el comprobante original a `estado='anulada'`

Salida:

- `NotaCreditoResult` con datos del comprobante emitido

### `buscarClientePorCuit(cuit)`

Comportamiento:

- sanitiza el CUIT
- exige 11 digitos
- obtiene access token vigente
- llama `padron-lookup`
- devuelve un `ClienteLookupResult` normalizado para UI

### Invariantes relevantes

- `fecha` del formulario entra como `DD/MM/YYYY` y se convierte a `YYYY-MM-DD` antes de Edge Functions.
- El documento receptor sale de `getClienteDocData(...)`.
- La condicion IVA del receptor se normaliza antes de persistir o invocar ARCA.
- La ventana de dias valida depende de `actividad`: bienes `5`, servicios `10`.
- La monotonia de fecha se evalua por `contribuyente_id`, `tipo_comprobante`, `estado='emitida'` y, si existe, `punto_venta`.
- `monto_maximo_factura` no se valida en `FacturacionService`: lo usa el contenedor de UI para pedir confirmacion antes de llamar al servicio.

---

## `generate-csr`

### Precondiciones

- Requiere `POST /functions/v1/generate-csr`.
- Requiere `Authorization: Bearer ...` con sesión Supabase válida.
- El gateway de Edge Functions valida al usuario.

### Request Body

```json
{
  "cuit": "20123456789",
  "razon_social": "Nombre o Razon Social"
}
```

### Response exitosa

```json
{
  "success": true,
  "csr": "-----BEGIN CERTIFICATE REQUEST-----\nMII...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMII..."
}
```

### Semántica de errores

- `400`: CUIT o Razón Social faltantes o inválidos.
- `401`: Token de autorización faltante o inválido.
- `405`: Método HTTP diferente de `POST`.
- `500`: Error interno al generar la clave RSA o al codificar el CSR.

---

## `mercadopago-sync`

### Precondiciones

- Requiere acciones a través de query parameters: `action=search` o `action=process-batch`.
- Requiere `Authorization: Bearer ...` con sesión Supabase válida.
- Requiere que el contribuyente del usuario autenticado posea un `mp_access_token` cargado en base de datos.

### Acciones soportadas

#### `action=search`

Consulta pagos aprobados de Mercado Pago que aún no han sido conciliados.

Request:
- Query parameters:
  - `begin_date`: string en formato ISO 8601 con offset (ej. `2026-05-20T00:00:00-03:00`).
  - `end_date`: string en formato ISO 8601 con offset.

Response exitosa:
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "9876543210",
        "date_created": "2026-05-25T15:20:00.000-03:00",
        "transaction_amount": 25000.00,
        "description": "Pago de Honorarios",
        "payer": {
          "first_name": "María",
          "last_name": "Gómez"
        }
      }
    ],
    "total": 1,
    "filtered_out": 0
  }
}
```

#### `action=process-batch`

Registra y procesa la facturación del lote de cobros de Mercado Pago.

Request:
- Body JSON:
```json
{
  "facturar": ["9876543210"],
  "ignorar": ["9876543211"],
  "payments_data": {
    "9876543210": {
      "transaction_amount": 25000.00,
      "date_created": "2026-05-25T15:20:00.000-03:00",
      "description": "Pago de Honorarios",
      "payer_name": "María Gómez"
    }
  }
}
```

Response exitosa:
```json
{
  "success": true,
  "data": {
    "batch_job_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
  }
}
```

### Reglas de procesamiento del lote

1. **Creación del Job**: Inserta una fila en `mp_batch_jobs` con estado `processing` y contadores en 0.
2. **Ignorar**: Los IDs en el array `ignorar` se insertan masivamente en `mp_conciliaciones` con estado `ignorado`.
3. **Ordenamiento**: Los IDs en `facturar` se ordenan por su `date_created` de forma ascendente.
4. **Bucle secuencial**: Para cada ID a facturar:
   - Valida si el pago ya fue conciliado (evita duplicidad).
   - Determina la fecha de la factura aplicando clamping para que cumpla con la ventana fiscal (5 o 10 días hacia atrás según actividad) y no sea anterior a la última factura emitida.
   - Resuelve el tipo de comprobante (B o C) según la condición fiscal del emisor.
   - Llama a `electronicBillingService` de ARCA para autorizar y obtener CAE.
   - En caso de éxito, inserta en `comprobantes` e inserta en `mp_conciliaciones` con `status = 'facturado'`.
   - En caso de error, registra en `mp_conciliaciones` con `status = 'fallido'` y el mensaje correspondiente.
   - Actualiza en tiempo real `mp_batch_jobs` incrementando los contadores y anexando el resultado al JSONB de logs.
5. **Finalización**: Cambia el estado del Job a `completed`.

### Semántica de errores

- `400`: Falta token de Mercado Pago en el contribuyente o payload mal formado.
- `401`: Token de sesión inválido.
- `500`: Falla general de base de datos o fallo al instanciar el SDK de ARCA.
