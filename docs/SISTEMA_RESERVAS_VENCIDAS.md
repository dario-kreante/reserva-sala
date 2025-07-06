# Sistema de Reservas Vencidas - Automatización de Estados

## 📋 Descripción

Sistema automatizado para gestionar reservas pendientes que han quedado con fechas/horarios pasados, marcándolas automáticamente como "vencidas" para mantener la integridad del sistema.

## 🎯 Problema Resuelto

**Situación Anterior:**
- Reservas pendientes quedaban indefinidamente en ese estado
- No se podía distinguir entre reservas pendientes vigentes y vencidas
- Administradores podían aprobar inadvertidamente reservas de fechas pasadas
- Acumulación de reservas obsoletas en el sistema

**Solución Implementada:**
- Estado nuevo `'vencida'` para reservas con fechas/horarios pasados
- Cron job automático que se ejecuta diariamente
- Logging completo de las operaciones
- Prevención de aprobación de reservas vencidas

## 🗄️ Cambios en Base de Datos

### Estado Agregado
```sql
-- Estados disponibles (actualizado)
'pendiente' | 'aprobada' | 'rechazada' | 'cancelada' | 'vencida'
```

### Tabla de Logs
```sql
CREATE TABLE logs_sistema (
  id bigserial PRIMARY KEY,
  tipo_operacion varchar(100) NOT NULL,
  descripcion text,
  detalles jsonb,
  fecha_creacion timestamptz DEFAULT NOW()
);
```

### Índices Optimizados
```sql
-- Para consultas eficientes de reservas pendientes por fecha
CREATE INDEX idx_reservas_estado_fecha ON reservas(estado, fecha) 
WHERE estado = 'pendiente';

-- Para consultas de logs del sistema
CREATE INDEX idx_logs_sistema_tipo_fecha ON logs_sistema(tipo_operacion, fecha_creacion);
```

## ⚙️ Funciones Implementadas

### 1. `marcar_reservas_vencidas()`
**Propósito:** Identifica y marca como vencidas las reservas pendientes con fechas pasadas.

**Criterios de Vencimiento:**
- `fecha < CURRENT_DATE` (fechas pasadas)
- `fecha = CURRENT_DATE AND hora_fin < CURRENT_TIME` (mismo día pero hora ya pasó)

**Retorno:**
```sql
RETURNS TABLE(
  reservas_actualizadas integer,
  detalles jsonb
)
```

### 2. `cron_marcar_reservas_vencidas()`
**Propósito:** Wrapper para el cron job que ejecuta la función principal y registra logs.

**Características:**
- Ejecuta `marcar_reservas_vencidas()`
- Registra resultados en `logs_sistema`
- Manejo de errores automático

## 🕐 Cron Job Configurado

### Programación
```sql
-- Ejecuta todos los días a las 2:00 AM
SELECT cron.schedule(
  'marcar-reservas-vencidas',
  '0 2 * * *',
  'SELECT cron_marcar_reservas_vencidas();'
);
```

### Horario Seleccionado
- **2:00 AM**: Horario de baja actividad del sistema
- **Diario**: Garantiza procesamiento oportuno
- **Timezone**: UTC (ajustar según zona horaria del servidor)

## 📊 Monitoreo y Logs

### Consulta de Logs Recientes
```sql
SELECT 
  id,
  tipo_operacion,
  descripcion,
  detalles->0->>'reserva_id' as primera_reserva_procesada,
  jsonb_array_length(detalles) as total_procesadas,
  fecha_creacion
FROM logs_sistema 
WHERE tipo_operacion = 'cron_reservas_vencidas'
ORDER BY fecha_creacion DESC 
LIMIT 10;
```

### Verificar Reservas Vencidas
```sql
SELECT 
  estado,
  COUNT(*) as total,
  MIN(fecha) as fecha_mas_antigua,
  MAX(fecha) as fecha_mas_reciente
FROM reservas 
WHERE estado = 'vencida'
GROUP BY estado;
```

## 🔧 Administración Manual

### Ejecutar Manualmente
```sql
-- Ejecutar el proceso inmediatamente
SELECT marcar_reservas_vencidas();
```

### Verificar Cron Jobs Activos
```sql
-- Ver cron jobs configurados
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'marcar-reservas-vencidas';
```

### Pausar/Reanudar Cron Job
```sql
-- Pausar
SELECT cron.unschedule('marcar-reservas-vencidas');

-- Reanudar
SELECT cron.schedule(
  'marcar-reservas-vencidas',
  '0 2 * * *',
  'SELECT cron_marcar_reservas_vencidas();'
);
```

## 🎨 Impacto en Frontend

### Componentes Afectados
- **Lista de Reservas**: Mostrar estado "Vencida" con estilo distintivo
- **Formulario de Aprobación**: Deshabilitar aprobación para reservas vencidas
- **Filtros**: Agregar filtro por estado vencido
- **Dashboard**: Estadísticas que incluyan reservas vencidas

### Estilos Sugeridos
```css
.reserva-vencida {
  background-color: #fef2f2; /* bg-red-50 */
  border-color: #fecaca; /* border-red-200 */
  color: #991b1b; /* text-red-800 */
}

.badge-vencida {
  background-color: #dc2626; /* bg-red-600 */
  color: white;
}
```

## ⚠️ Consideraciones Importantes

### Seguridad
- Función `SECURITY DEFINER`: Se ejecuta con privilegios del propietario
- Solo usuarios autorizados pueden ejecutar manualmente
- Logs auditables de todas las operaciones

### Performance
- Índices optimizados para consultas frecuentes
- Proceso eficiente que procesa solo registros necesarios
- Ejecución en horario de baja actividad

### Recuperación
- Las reservas marcadas como vencidas NO se pueden revertir automáticamente
- Require intervención manual del administrador si es necesario
- Mantener backups regulares antes de cambios masivos

## 🚀 Próximos Pasos

### Mejoras Futuras
1. **Notificaciones**: Enviar emails a usuarios con reservas vencidas
2. **Dashboard Analytics**: Métricas de reservas vencidas por período
3. **Alertas Proactivas**: Notificar 24h antes del vencimiento
4. **Configuración Dinámica**: Permitir ajustar horarios desde admin panel

### Integración con Notificaciones
```sql
-- Función futura para notificar antes del vencimiento
CREATE FUNCTION notificar_reservas_proximas_vencer()
RETURNS void AS $$
-- Lógica para enviar recordatorios
$$;
```

## 📚 Referencias

- **Migración**: `supabase/migrations/004_add_vencida_estado_and_cron.sql`
- **Tipos TypeScript**: `types/supabase.ts` (actualizado)
- **Documentación pg_cron**: https://github.com/citusdata/pg_cron
- **Supabase Edge Functions**: Para notificaciones futuras

---

**Nota**: Este sistema mejora significativamente la gestión de estados de reservas y mantiene la base de datos limpia y consistente automáticamente. 