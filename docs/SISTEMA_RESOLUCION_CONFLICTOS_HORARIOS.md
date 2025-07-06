# Sistema de Resolución Automática de Conflictos de Horarios

## Descripción General

Este sistema resuelve automáticamente los conflictos que ocurren cuando se crean horarios académicos recurrentes que se superponen con reservas existentes de usuarios. 

**Jerarquía de Prioridad:**
- 🔴 **Máxima prioridad**: Reservas del sistema (horarios académicos)
- 🟡 **Menor prioridad**: Reservas de usuarios normales

## Problema Resuelto

Anteriormente, cuando se creaban horarios recurrentes para clases, estos podían superponerse con reservas individuales de usuarios, causando:
- Doble reserva de la misma sala
- Conflictos en el calendario
- Confusión para usuarios y administradores
- Necesidad de cancelación manual

## Solución Implementada

### ✅ Cancelación Automática
Cuando se crea una reserva del sistema, **automáticamente**:
1. Detecta reservas de usuarios que se superponen en horario
2. Cancela las reservas conflictivas de menor prioridad
3. Actualiza el motivo de cancelación
4. Envía notificaciones explicativas a los usuarios afectados

### ✅ Notificaciones Inteligentes
Los usuarios reciben notificaciones claras explicando:
- Qué reserva fue cancelada
- Por qué motivo (horario académico específico)
- Instrucciones para solicitar nueva reserva

## Componentes del Sistema

### 1. Funciones Principales

#### `detectar_conflictos_horarios()`
Detecta reservas que se superponen en horario para una sala específica.

```sql
SELECT * FROM detectar_conflictos_horarios(
  sala_id, fecha, hora_inicio, hora_fin, reserva_excluir_id
);
```

#### `cancelar_reservas_conflictivas()`
Cancela automáticamente las reservas de usuarios que entran en conflicto.

```sql
SELECT cancelar_reservas_conflictivas(
  reserva_sistema_id, sala_id, fecha, hora_inicio, hora_fin, nombre_modulo
);
```

### 2. Trigger Automático

El trigger `resolver_conflictos_horarios_trigger` se ejecuta automáticamente al insertar reservas del sistema (`es_reserva_sistema = true`).

### 3. Funciones de Utilidad

#### Simulación de Conflictos
```sql
-- Ver qué reservas serían afectadas SIN cancelarlas
SELECT * FROM simular_conflictos_horarios(
  sala_id, fecha, hora_inicio, hora_fin
);
```

#### Estadísticas
```sql
-- Obtener estadísticas de cancelaciones automáticas
SELECT obtener_estadisticas_cancelaciones_automaticas(30);
```

#### Reversión de Emergencia
```sql
-- Revertir cancelaciones automáticas en caso de error
SELECT revertir_cancelaciones_automaticas('2025-06-01', '2025-06-01');
```

## Resultados de Pruebas

### ✅ Prueba de Conflictos Múltiples

**Escenario:**
- Reservas de usuario: 09:00-10:00 y 10:30-11:30
- Reserva del sistema: 09:30-11:00 (Matemáticas Avanzadas)

**Resultado:**
- ✅ 2 reservas de usuario canceladas automáticamente
- ✅ 2 notificaciones enviadas al usuario
- ✅ Motivo claro: "Conflicto con horario académico programado"
- ✅ Reserva del sistema creada exitosamente

### 📊 Estadísticas del Test
```json
{
  "total_cancelaciones_automaticas": 2,
  "usuarios_unicos_afectados": 1,
  "promedio_cancelaciones_por_dia": 0.07,
  "cancelaciones_por_dia": {"2025-06-01": 2}
}
```

## Flujo de Trabajo

### Escenario: Creación de Horario Recurrente

1. **Administrador crea horario recurrente** para "Cálculo I"
2. **Sistema genera reservas automáticas** para el semestre
3. **Trigger detecta conflictos** con reservas existentes de usuarios
4. **Cancelación automática** de reservas de menor prioridad
5. **Notificación inmediata** a usuarios afectados
6. **Usuario puede solicitar** nueva reserva para otro horario

### Tipos de Notificación

```
"Su reserva para el 15/06/2025 en la sala Aula 301 ha sido cancelada 
automáticamente debido a un conflicto con el horario académico: Cálculo I. 
Por favor solicite una nueva reserva para otro horario."
```

## Configuración del Sistema

### Estados de Reserva Manejados
- ✅ **pendiente**: Se cancela automáticamente
- ✅ **aprobada**: Se cancela automáticamente  
- ❌ **cancelada**: No se procesa
- ❌ **rechazada**: No se procesa

### Detección de Superposición
El sistema detecta conflictos cuando:
```
(hora_inicio_reserva < hora_fin_horario) AND (hora_fin_reserva > hora_inicio_horario)
```

### Motivos de Cancelación
- **Motivo estándar**: "Conflicto con horario académico programado"
- **Comentario extendido**: Incluye detalles del módulo y horario específico

## Comandos de Administración

### Monitoreo
```sql
-- Ver estadísticas generales
SELECT obtener_estadisticas_cancelaciones_automaticas(30);

-- Simular conflictos antes de crear horario
SELECT * FROM simular_conflictos_horarios(1, '2025-06-15', '09:00', '11:00');
```

### Mantenimiento
```sql
-- Revertir cancelaciones en caso de error
SELECT revertir_cancelaciones_automaticas('2025-06-01');

-- Ver todas las cancelaciones automáticas recientes
SELECT * FROM reservas 
WHERE estado = 'cancelada' 
  AND motivo_rechazo = 'Conflicto con horario académico programado'
  AND fecha >= CURRENT_DATE
ORDER BY ultima_actualizacion DESC;
```

## Ventajas del Sistema

### 🚀 Automático
- Sin intervención manual requerida
- Proceso inmediato y consistente

### 📋 Transparente
- Notificaciones claras y detalladas
- Registro completo de todas las acciones

### ⚡ Eficiente
- Resolución instantánea de conflictos
- Reducción de trabajo administrativo

### 🔄 Reversible
- Capacidad de revertir cancelaciones automáticas
- Historial completo de cambios

## Próximos Pasos Recomendados

1. **Monitoreo Inicial**: Supervisar el sistema durante las primeras semanas
2. **Ajuste de Notificaciones**: Personalizar mensajes según tipo de curso
3. **Reportes Automáticos**: Crear reportes semanales de conflictos resueltos
4. **Integración con Calendario**: Sincronizar cancelaciones con sistemas externos
5. **Métricas de Usuario**: Medir satisfacción y efectividad del sistema

## Estado del Sistema

✅ **ACTIVO Y FUNCIONANDO**
- Sistema completamente implementado
- Probado exitosamente
- Listo para uso en producción
- Integrado con sistema de notificaciones existente 