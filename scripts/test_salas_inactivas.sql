-- Script de Pruebas para el Filtro de Salas Inactivas
-- Ejecutar en Supabase SQL Editor para verificar la implementación

-- 1. Ver estado actual de todas las salas
SELECT id, nombre, activo, tipo, centro 
FROM salas 
ORDER BY nombre;

-- 2. Contar salas activas vs inactivas
SELECT 
  activo,
  COUNT(*) as cantidad,
  STRING_AGG(nombre, ', ') as salas
FROM salas 
GROUP BY activo
ORDER BY activo DESC;

-- 3. Ver reservas de salas activas vs inactivas
SELECT 
  s.activo as sala_activa,
  COUNT(r.id) as total_reservas,
  COUNT(CASE WHEN r.estado = 'pendiente' THEN 1 END) as pendientes,
  COUNT(CASE WHEN r.estado = 'aprobada' THEN 1 END) as aprobadas
FROM reservas r
JOIN salas s ON r.sala_id = s.id
GROUP BY s.activo
ORDER BY s.activo DESC;

-- 4. Test: Desactivar una sala específica (cambiar ID según sea necesario)
-- UPDATE salas SET activo = false WHERE id = 1;

-- 5. Test: Verificar que las funciones de disponibilidad no devuelven datos para salas inactivas
-- SELECT * FROM obtener_disponibilidad_sala_mes_v2(1, 2024, 12);

-- 6. Test: Reactivar la sala
-- UPDATE salas SET activo = true WHERE id = 1;

-- 7. Verificar que no hay problemas con consultas JOIN
SELECT COUNT(*) as total_reservas_salas_activas
FROM reservas r
JOIN salas s ON r.sala_id = s.id
WHERE s.activo = true;

-- 8. Verificar funcionamiento de funciones de disponibilidad con salas activas
SELECT 
  s.id,
  s.nombre,
  s.activo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM obtener_disponibilidad_sala_mes_v2(s.id, 2024, 12) LIMIT 1
    ) THEN 'Función devuelve datos'
    ELSE 'Función NO devuelve datos'
  END as resultado_funcion
FROM salas s
ORDER BY s.activo DESC, s.nombre;

-- 9. Información de diagnóstico
SELECT 
  'Salas activas' as tipo,
  COUNT(*) as cantidad
FROM salas 
WHERE activo = true
UNION ALL
SELECT 
  'Salas inactivas' as tipo,
  COUNT(*) as cantidad
FROM salas 
WHERE activo = false
UNION ALL
SELECT 
  'Total reservas de salas activas' as tipo,
  COUNT(*) as cantidad
FROM reservas r
JOIN salas s ON r.sala_id = s.id
WHERE s.activo = true
UNION ALL
SELECT 
  'Total reservas de salas inactivas' as tipo,
  COUNT(*) as cantidad
FROM reservas r
JOIN salas s ON r.sala_id = s.id
WHERE s.activo = false; 