-- Script manual para marcar reservas vencidas
-- Ejecutar diariamente para mantener el sistema limpio
-- Uso: Ejecutar desde el dashboard de Supabase o via CLI

-- Verificar reservas pendientes antes del procesamiento
SELECT 
  'ANTES DEL PROCESAMIENTO' as momento,
  COUNT(*) as total_pendientes,
  COUNT(CASE WHEN fecha < CURRENT_DATE THEN 1 END) as pendientes_vencidas_fecha,
  COUNT(CASE WHEN fecha = CURRENT_DATE AND hora_fin < CURRENT_TIME THEN 1 END) as pendientes_vencidas_hora
FROM reservas 
WHERE estado = 'pendiente';

-- Ejecutar el marcado de reservas vencidas
SELECT marcar_reservas_vencidas();

-- Verificar el resultado después del procesamiento
SELECT 
  'DESPUÉS DEL PROCESAMIENTO' as momento,
  COUNT(*) as total_pendientes,
  COUNT(CASE WHEN estado = 'vencida' THEN 1 END) as total_vencidas
FROM reservas 
WHERE estado IN ('pendiente', 'vencida');

-- Ver estadísticas generales de estados
SELECT 
  estado,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM reservas 
GROUP BY estado
ORDER BY COUNT(*) DESC;

-- Ver los últimos logs del sistema
SELECT 
  id,
  tipo_operacion,
  descripcion,
  jsonb_array_length(detalles) as reservas_procesadas,
  fecha_creacion
FROM logs_sistema 
WHERE tipo_operacion LIKE '%reservas_vencidas%'
ORDER BY fecha_creacion DESC 
LIMIT 5; 