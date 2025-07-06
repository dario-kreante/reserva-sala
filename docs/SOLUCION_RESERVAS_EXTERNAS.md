# Solución Completa: Reservas Externas

## Problema Identificado

Al intentar crear reservas externas desde la interfaz `/mis-reservas`, se producía un error:

```
{
    "code": "23502",
    "details": "Failing row contains (..., null, null, crear_reservas, pendiente, ...",
    "hint": null,
    "message": "null value in column \"lote_id\" of relation \"lotes_notificaciones\" violates not-null constraint"
}
```

## Causa Raíz

El sistema de notificaciones por lotes no estaba preparado para manejar reservas externas que tienen `usuario_id = NULL`. Esto causaba problemas en:

1. **Función `crear_notificacion_reserva_batch`**: Intentaba usar `NEW.usuario_id` que era NULL para reservas externas
2. **Función `procesar_lotes_notificaciones`**: Intentaba insertar en `notificaciones` con `usuario_id = NULL` (no permitido)
3. **Función `enviar_notificacion_webhook`**: No tenía lógica para manejar reservas externas

## Solución Implementada

### 1. Actualización de `crear_notificacion_reserva_batch`

```sql
-- Determinar identificador del usuario (para reservas externas usar email)
IF NEW.usuario_id IS NOT NULL THEN
  v_usuario_identificador := NEW.usuario_id::TEXT;
ELSIF NEW.es_externo AND NEW.mail_externos IS NOT NULL THEN
  v_usuario_identificador := 'externo_' || NEW.mail_externos;
ELSE
  v_usuario_identificador := 'anonimo_' || NEW.id::TEXT;
END IF;
```

**Cambios clave:**
- Usa email externo como identificador cuando `usuario_id` es NULL
- Genera `lote_id` únicos para reservas externas
- Incluye `es_externo` en el contexto del lote

### 2. Nueva función `enviar_webhook_reserva_externa`

```sql
CREATE OR REPLACE FUNCTION enviar_webhook_reserva_externa(
  p_reserva_id INTEGER,
  p_tipo_operacion TEXT,
  p_contenido TEXT
) RETURNS VOID AS $$
-- Función específica para enviar webhooks directos a reservas externas
-- sin crear notificaciones internas
```

**Características:**
- Envía webhooks directamente a Make.com para reservas externas
- Obtiene información de la reserva (email, nombre, sala, etc.)
- No requiere tabla `notificaciones` (que requiere `usuario_id`)

### 3. Actualización de `procesar_lotes_notificaciones`

```sql
-- Manejar reservas externas vs internas
IF v_es_externo THEN
  -- Para reservas externas, enviar webhooks directos
  FOR v_reserva_id IN SELECT unnest(v_lote.reservas_ids)
  LOOP
    PERFORM enviar_webhook_reserva_externa(v_reserva_id, v_lote.tipo_operacion, v_contenido);
  END LOOP;
ELSE
  -- Para reservas internas, crear notificación normal
  INSERT INTO notificaciones (usuario_id, tipo, contenido, metadata)
  VALUES (v_lote.usuario_id, v_tipo, v_contenido, ...);
END IF;
```

**Lógica dual:**
- **Reservas internas**: Crea notificación en DB → Trigger envía webhook
- **Reservas externas**: Envía webhook directamente (sin notificación en DB)

### 4. Actualización de `enviar_notificacion_webhook`

```sql
-- Para notificaciones sin usuario_id, verificar si hay información de reserva externa
IF NEW.usuario_id IS NOT NULL THEN
  -- Lógica para usuarios internos
ELSE
  -- Obtener información de reserva externa del metadata
  SELECT r.mail_externos, r.solicitante_nombre_completo, r.es_externo
  FROM reservas r
  WHERE r.id = (NEW.metadata->>'reservas_ids')::jsonb->0::text::integer
    AND r.es_externo = true;
END IF;
```

## Flujo Completo de Reservas Externas

### Creación de Reserva Externa
1. Usuario completa formulario con `es_externo = true`
2. Se inserta reserva con `usuario_id = NULL`
3. Trigger `crear_notificacion_reserva_batch_insert` se ejecuta
4. Se crea lote con `lote_id` basado en email externo
5. Contexto incluye `es_externo: true`

### Procesamiento de Notificaciones
1. Cron job ejecuta `procesar_lotes_notificaciones()` cada minuto
2. Función detecta `es_externo = true` en contexto
3. Llama a `enviar_webhook_reserva_externa()` para cada reserva
4. Webhook se envía directamente a Make.com con datos externos
5. Lote se marca como procesado

### Aprobación/Rechazo de Reservas Externas
1. Admin aprueba/rechaza reserva externa
2. Trigger `crear_notificacion_reserva_batch_update` se ejecuta
3. Se crea nuevo lote con operación `aprobar_reservas`/`rechazar_reservas`
4. Procesamiento automático envía webhook con nueva información

## Datos del Webhook para Reservas Externas

```json
{
  "usuario_id": "externo",
  "tipo": "reserva",
  "contenido": "Su reserva en la sala Auditorio 111111 para el día 15/07/2025 ha sido registrada...",
  "email": "usuario@institucion.cl",
  "nombre_completo": "Juan Pérez García",
  "es_externo": true,
  "metadata": {
    "reserva_id": 1234,
    "tipo_operacion": "crear_reservas",
    "sala_nombre": "Auditorio 111111",
    "fecha": "2025-07-15",
    "hora_inicio": "10:00:00",
    "hora_fin": "12:00:00",
    "estado": "pendiente"
  }
}
```

## Validación de la Solución

### Pruebas Realizadas

1. **Reserva externa exitosa**: ✅
   - Creación sin errores de NOT NULL constraint
   - Lote generado correctamente con `usuario_id = NULL`
   - Webhook enviado a Make.com

2. **Reserva interna exitosa**: ✅
   - Funcionamiento normal sin cambios
   - Notificación creada en DB
   - Webhook enviado via trigger normal

3. **Procesamiento por lotes**: ✅
   - Ambos tipos de reservas procesadas correctamente
   - Lógica dual funciona sin conflictos

### Estados de Reserva Soportados

- **Creación**: `pendiente` → Notificación de registro
- **Aprobación**: `pendiente` → `aprobada` → Notificación de aprobación
- **Rechazo**: `pendiente` → `rechazada` → Notificación con motivo
- **Cancelación**: `cualquier_estado` → `cancelada` → Notificación de cancelación

## Consideraciones Técnicas

### Compatibilidad
- ✅ Reservas internas siguen funcionando igual
- ✅ Sistema de lotes mantiene eficiencia
- ✅ Webhooks de Make.com reciben datos consistentes
- ✅ No hay cambios en estructura de tablas principales

### Seguridad
- ✅ Validación de email externo antes de envío
- ✅ Logs de webhooks para debugging
- ✅ Manejo de errores en envío de webhooks
- ✅ Limpeza automática de lotes procesados

### Rendimiento
- ✅ Webhooks directos para externos (más rápido)
- ✅ Sin sobrecarga en tabla `notificaciones`
- ✅ Procesamiento por lotes mantiene eficiencia
- ✅ Cron job sigue ejecutándose cada minuto

## Resolución del Error Original

El error original:
```
null value in column "lote_id" of relation "lotes_notificaciones" violates not-null constraint
```

**Se resolvió mediante:**
1. Generación de `lote_id` usando email externo cuando `usuario_id` es NULL
2. Lógica condicional en procesamiento de lotes
3. Webhooks directos que evitan restricciones de `notificaciones`

## Conclusión

La solución implementada permite el manejo completo de reservas externas manteniendo la compatibilidad con el sistema existente. Las reservas externas ahora:

- ✅ Se crean sin errores de constrains
- ✅ Generan notificaciones automáticas via webhook
- ✅ Siguen el mismo flujo de aprobación/rechazo
- ✅ Mantienen trazabilidad completa en logs

El sistema es robusto y maneja tanto reservas internas como externas de manera eficiente y segura. 