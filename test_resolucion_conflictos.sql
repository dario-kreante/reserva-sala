-- TEST: Sistema de Resolución Automática de Conflictos de Horarios
-- Este script prueba la funcionalidad completa del sistema

-- 1. SETUP: Crear datos de prueba
DO $$
DECLARE
  v_sala_id INTEGER;
  v_usuario_id UUID;
  v_reserva_usuario_1 INTEGER;
  v_reserva_usuario_2 INTEGER;
  v_reserva_sistema INTEGER;
  v_fecha_prueba DATE := CURRENT_DATE + INTERVAL '10 days';
BEGIN
  RAISE NOTICE 'Iniciando pruebas de resolución de conflictos...';
  
  -- Obtener una sala existente
  SELECT id INTO v_sala_id FROM salas WHERE activo = true LIMIT 1;
  
  -- Obtener un usuario existente
  SELECT id INTO v_usuario_id FROM usuarios WHERE activo = true LIMIT 1;
  
  RAISE NOTICE 'Usando sala_id: %, usuario_id: %, fecha: %', v_sala_id, v_usuario_id, v_fecha_prueba;
  
  -- Crear reservas de usuarios que serán conflictivas
  INSERT INTO reservas (
    usuario_id, sala_id, fecha, hora_inicio, hora_fin, estado, 
    es_reserva_sistema, comentario
  ) VALUES 
  (v_usuario_id, v_sala_id, v_fecha_prueba, '09:00:00', '10:00:00', 'aprobada', false, 'Reserva usuario 1 - SERÁ CANCELADA'),
  (v_usuario_id, v_sala_id, v_fecha_prueba, '10:30:00', '11:30:00', 'pendiente', false, 'Reserva usuario 2 - SERÁ CANCELADA')
  RETURNING id INTO v_reserva_usuario_1;
  
  -- Obtener ID de la segunda reserva
  SELECT id INTO v_reserva_usuario_2 
  FROM reservas 
  WHERE usuario_id = v_usuario_id 
    AND sala_id = v_sala_id 
    AND fecha = v_fecha_prueba 
    AND hora_inicio = '10:30:00';
  
  RAISE NOTICE 'Reservas de usuario creadas: % y %', v_reserva_usuario_1, v_reserva_usuario_2;
  
  -- 2. SIMULACIÓN: Ver qué conflictos se detectarían
  RAISE NOTICE 'Simulando conflictos para horario 09:30-11:00...';
  PERFORM simular_conflictos_horarios(v_sala_id, v_fecha_prueba, '09:30:00', '11:00:00');
  
  -- 3. PRUEBA REAL: Crear reserva del sistema que cause conflictos
  RAISE NOTICE 'Creando reserva del sistema que causará conflictos...';
  
  INSERT INTO reservas (
    usuario_id, sala_id, fecha, hora_inicio, hora_fin, estado, 
    es_reserva_sistema, nombre_modulo, comentario, horario_id
  ) VALUES (
    v_usuario_id, -- Usuario admin/sistema
    v_sala_id, 
    v_fecha_prueba, 
    '09:30:00', 
    '11:00:00', 
    'aprobada', 
    true, 
    'Matemáticas Avanzadas',
    'Reserva automática generada por horario',
    999 -- ID ficticio de horario
  ) RETURNING id INTO v_reserva_sistema;
  
  RAISE NOTICE 'Reserva del sistema creada con ID: %', v_reserva_sistema;
  
  -- Esperar un momento para que se procesen los triggers
  PERFORM pg_sleep(1);
  
  -- 4. VERIFICACIÓN: Comprobar resultados
  RAISE NOTICE 'Verificando resultados de las cancelaciones automáticas...';
  
  -- Verificar estado de las reservas de usuarios
  PERFORM r.id, r.estado, r.motivo_rechazo
  FROM reservas r
  WHERE r.id IN (v_reserva_usuario_1, v_reserva_usuario_2);
  
  -- Verificar notificaciones creadas
  PERFORM n.contenido, n.tipo
  FROM notificaciones n
  WHERE n.metadata->>'reserva_sistema_id' = v_reserva_sistema::TEXT;
  
  RAISE NOTICE 'Prueba completada exitosamente!';
  
END $$;

-- 5. CONSULTAS DE VERIFICACIÓN
SELECT 
  'RESERVAS AFTER TEST' as tipo,
  id,
  es_reserva_sistema,
  estado,
  hora_inicio,
  hora_fin,
  motivo_rechazo,
  comentario
FROM reservas 
WHERE fecha = CURRENT_DATE + INTERVAL '10 days'
ORDER BY hora_inicio;

-- 6. VERIFICAR NOTIFICACIONES GENERADAS
SELECT 
  'NOTIFICACIONES GENERADAS' as tipo,
  tipo,
  contenido,
  metadata->'motivo' as motivo,
  metadata->'modulo_conflictivo' as modulo,
  created_at
FROM notificaciones 
WHERE metadata->>'tipo_notificacion' = 'cancelacion_automatica'
  AND created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- 7. ESTADÍSTICAS DEL SISTEMA
SELECT obtener_estadisticas_cancelaciones_automaticas(30) as estadisticas;

-- 8. CLEANUP: Limpiar datos de prueba
DELETE FROM reservas WHERE fecha = CURRENT_DATE + INTERVAL '10 days';
DELETE FROM notificaciones 
WHERE metadata->>'tipo_notificacion' = 'cancelacion_automatica'
  AND created_at >= NOW() - INTERVAL '5 minutes';

RAISE NOTICE 'Datos de prueba limpiados. Test completado!'; 