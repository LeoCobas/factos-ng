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
- Requiere contribuyente del usuario autenticado.
- Requiere `arca_cert` y `arca_key`.
- Usa bucket `padron` dentro de `contribuyentes.arca_ticket`.

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
