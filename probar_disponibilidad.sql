-- Script para probar la lógica de disponibilidad con un caso específico
-- Este script crea una reserva de prueba y luego verifica la disponibilidad

-- 1. Crear una reserva de prueba para el 10 de marzo de 2025 de 00:00 a 13:00
DO $$
DECLARE
  v_sala_id INTEGER := 40; -- ID de la sala a probar
  v_fecha DATE := '2025-03-10'; -- Fecha de la reserva
  v_hora_inicio TIME := '00:00:00'; -- Hora de inicio
  v_hora_fin TIME := '13:00:00'; -- Hora de fin
  v_usuario_id TEXT; -- ID del usuario (se obtendrá de la base de datos)
BEGIN
  -- Obtener un ID de usuario válido
  SELECT id INTO v_usuario_id FROM usuarios LIMIT 1;
  
  -- Eliminar reservas existentes para esta sala y fecha (para evitar duplicados)
  DELETE FROM reservas 
  WHERE sala_id = v_sala_id 
    AND fecha = v_fecha 
    AND hora_inicio = v_hora_inicio 
    AND hora_fin = v_hora_fin;
  
  -- Insertar la reserva de prueba
  INSERT INTO reservas (
    sala_id, 
    usuario_id, 
    fecha, 
    hora_inicio, 
    hora_fin, 
    estado, 
    es_urgente
  ) VALUES (
    v_sala_id,
    v_usuario_id,
    v_fecha,
    v_hora_inicio,
    v_hora_fin,
    'aprobada',
    false
  );
  
  RAISE NOTICE 'Reserva de prueba creada para la sala % el % de %:00 a %:00', 
    v_sala_id, v_fecha, v_hora_inicio, v_hora_fin;
END;
$$;

-- 2. Probar la disponibilidad para el mes de marzo de 2025
SELECT 
  jsonb_pretty(
    obtener_disponibilidad_sala_mes_json_v2(
      40, -- ID de la sala
      2025, -- Año
      3 -- Mes (marzo)
    )
  ) AS disponibilidad_json;

-- 3. Verificar específicamente la disponibilidad del día 10 de marzo
WITH disponibilidad AS (
  SELECT 
    jsonb_array_elements(
      obtener_disponibilidad_sala_mes_json_v2(
        40, -- ID de la sala
        2025, -- Año
        3 -- Mes (marzo)
      )->'dias'
    ) AS dia
)
SELECT 
  dia->>'fecha' AS fecha,
  (dia->>'disponible')::BOOLEAN AS disponible,
  (dia->>'bloques_disponibles')::INTEGER AS bloques_disponibles,
  (dia->>'bloques_totales')::INTEGER AS bloques_totales,
  (dia->>'porcentaje_disponibilidad')::NUMERIC AS porcentaje_disponibilidad
FROM disponibilidad
WHERE dia->>'fecha' = '2025-03-10'; 