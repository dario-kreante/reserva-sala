-- =====================================================
-- SISTEMA DE RESOLUCIÓN AUTOMÁTICA DE CONFLICTOS DE HORARIOS
-- Versión: 1.0
-- Fecha: 2025-06-01
-- =====================================================

-- DESCRIPCIÓN:
-- Este sistema resuelve automáticamente los conflictos cuando se crean 
-- horarios académicos recurrentes que se superponen con reservas de usuarios.
-- Las reservas del sistema tienen prioridad sobre las reservas de usuarios.

-- =====================================================
-- 1. FUNCIÓN: Detectar conflictos de horarios
-- =====================================================

CREATE OR REPLACE FUNCTION detectar_conflictos_horarios(
  p_sala_id INTEGER,
  p_fecha DATE,
  p_hora_inicio TIME,
  p_hora_fin TIME,
  p_reserva_sistema_id INTEGER DEFAULT NULL
) RETURNS TABLE (
  reserva_id INTEGER,
  usuario_id UUID,
  estado VARCHAR(50),
  hora_inicio TIME,
  hora_fin TIME,
  es_sistema BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.usuario_id,
    r.estado,
    r.hora_inicio,
    r.hora_fin,
    r.es_reserva_sistema
  FROM reservas r
  WHERE r.sala_id = p_sala_id
    AND r.fecha = p_fecha
    AND r.estado IN ('pendiente', 'aprobada')
    AND (p_reserva_sistema_id IS NULL OR r.id != p_reserva_sistema_id)
    AND (
      -- Detectar solapamiento de horarios
      (r.hora_inicio < p_hora_fin AND r.hora_fin > p_hora_inicio)
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. FUNCIÓN: Cancelar reservas conflictivas
-- =====================================================

CREATE OR REPLACE FUNCTION cancelar_reservas_conflictivas(
  p_reserva_sistema_id INTEGER,
  p_sala_id INTEGER,
  p_fecha DATE,
  p_hora_inicio TIME,
  p_hora_fin TIME,
  p_nombre_modulo TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_conflicto RECORD;
  v_reservas_canceladas INTEGER := 0;
  v_usuarios_afectados UUID[] := '{}';
  v_detalles_cancelaciones JSONB := '[]'::jsonb;
  v_detalle_cancelacion JSONB;
  v_sala_nombre TEXT;
BEGIN
  -- Obtener nombre de la sala
  SELECT nombre INTO v_sala_nombre FROM salas WHERE id = p_sala_id;
  
  -- Buscar reservas conflictivas (solo de usuarios, no del sistema)
  FOR v_conflicto IN 
    SELECT * FROM detectar_conflictos_horarios(p_sala_id, p_fecha, p_hora_inicio, p_hora_fin, p_reserva_sistema_id)
    WHERE es_sistema = false  -- Solo cancelar reservas de usuarios
  LOOP
    -- Cancelar la reserva conflictiva
    UPDATE reservas 
    SET 
      estado = 'cancelada',
      motivo_rechazo = 'Conflicto con horario académico programado',
      comentario = COALESCE(comentario, '') || 
                  ' | CANCELADA AUTOMÁTICAMENTE: Conflicto con ' || 
                  COALESCE(p_nombre_modulo, 'horario académico') ||
                  ' programado para ' || p_hora_inicio::TEXT || '-' || p_hora_fin::TEXT,
      ultima_actualizacion = NOW()
    WHERE id = v_conflicto.reserva_id;
    
    -- Agregar usuario a la lista de afectados
    v_usuarios_afectados := array_append(v_usuarios_afectados, v_conflicto.usuario_id);
    
    -- Crear detalle de la cancelación
    v_detalle_cancelacion := jsonb_build_object(
      'reserva_id', v_conflicto.reserva_id,
      'usuario_id', v_conflicto.usuario_id,
      'hora_original', v_conflicto.hora_inicio::TEXT || '-' || v_conflicto.hora_fin::TEXT,
      'motivo', 'Conflicto con horario académico: ' || COALESCE(p_nombre_modulo, 'Clase programada')
    );
    
    v_detalles_cancelaciones := v_detalles_cancelaciones || v_detalle_cancelacion;
    v_reservas_canceladas := v_reservas_canceladas + 1;
    
    RAISE NOTICE 'Reserva % cancelada automáticamente por conflicto con horario del sistema', v_conflicto.reserva_id;
  END LOOP;
  
  -- Retornar resumen de cancelaciones
  RETURN jsonb_build_object(
    'reservas_canceladas', v_reservas_canceladas,
    'usuarios_afectados', v_usuarios_afectados,
    'sala_nombre', v_sala_nombre,
    'fecha', p_fecha,
    'horario_sistema', p_hora_inicio::TEXT || '-' || p_hora_fin::TEXT,
    'nombre_modulo', p_nombre_modulo,
    'detalles', v_detalles_cancelaciones,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. FUNCIÓN TRIGGER: Resolver conflictos automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION resolver_conflictos_automatico()
RETURNS TRIGGER AS $$
DECLARE
  v_resultado_cancelaciones JSONB;
  v_usuarios_afectados UUID[];
  v_total_canceladas INTEGER;
BEGIN
  -- Solo procesar si es una reserva del sistema
  IF NEW.es_reserva_sistema = true THEN
    
    -- Cancelar reservas conflictivas
    SELECT cancelar_reservas_conflictivas(
      NEW.id,
      NEW.sala_id,
      NEW.fecha,
      NEW.hora_inicio,
      NEW.hora_fin,
      NEW.nombre_modulo
    ) INTO v_resultado_cancelaciones;
    
    v_total_canceladas := (v_resultado_cancelaciones->>'reservas_canceladas')::INTEGER;
    
    -- Si se cancelaron reservas, crear notificaciones para usuarios afectados
    IF v_total_canceladas > 0 THEN
      -- Extraer usuarios afectados del resultado JSON
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(v_resultado_cancelaciones->'usuarios_afectados')::UUID
      ) INTO v_usuarios_afectados;
      
      -- Crear notificaciones para cada usuario afectado
      FOR i IN 1..array_length(v_usuarios_afectados, 1) LOOP
        INSERT INTO notificaciones (usuario_id, tipo, contenido, metadata)
        VALUES (
          v_usuarios_afectados[i],
          'alerta',
          'Su reserva para el ' || TO_CHAR(NEW.fecha, 'DD/MM/YYYY') || 
          ' en la sala ' || (v_resultado_cancelaciones->>'sala_nombre') ||
          ' ha sido cancelada automáticamente debido a un conflicto con el horario académico: ' ||
          COALESCE(NEW.nombre_modulo, 'Clase programada') || 
          '. Por favor solicite una nueva reserva para otro horario.',
          jsonb_build_object(
            'tipo_notificacion', 'cancelacion_automatica',
            'motivo', 'conflicto_horario_academico',
            'reserva_sistema_id', NEW.id,
            'modulo_conflictivo', NEW.nombre_modulo,
            'fecha_conflicto', NEW.fecha,
            'horario_conflicto', (v_resultado_cancelaciones->>'horario_sistema'),
            'detalles_cancelacion', v_resultado_cancelaciones
          )
        );
      END LOOP;
      
      RAISE NOTICE 'Sistema de resolución de conflictos: % reservas canceladas para reserva del sistema %', 
        v_total_canceladas, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGER: Activar resolución automática
-- =====================================================

DROP TRIGGER IF EXISTS resolver_conflictos_horarios_trigger ON reservas;
CREATE TRIGGER resolver_conflictos_horarios_trigger
AFTER INSERT ON reservas
FOR EACH ROW
WHEN (NEW.es_reserva_sistema = true)
EXECUTE FUNCTION resolver_conflictos_automatico();

-- =====================================================
-- 5. FUNCIÓN UTILIDAD: Simular conflictos (sin cancelar)
-- =====================================================

CREATE OR REPLACE FUNCTION simular_conflictos_horarios(
  p_sala_id INTEGER,
  p_fecha DATE,
  p_hora_inicio TIME,
  p_hora_fin TIME
) RETURNS TABLE (
  reserva_conflictiva INTEGER,
  usuario_email TEXT,
  hora_reserva TEXT,
  estado_actual TEXT,
  seria_cancelada BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    u.email,
    r.hora_inicio::TEXT || '-' || r.hora_fin::TEXT,
    r.estado,
    (r.es_reserva_sistema = false) as seria_cancelada
  FROM reservas r
  JOIN usuarios u ON r.usuario_id = u.id
  WHERE r.sala_id = p_sala_id
    AND r.fecha = p_fecha
    AND r.estado IN ('pendiente', 'aprobada')
    AND (r.hora_inicio < p_hora_fin AND r.hora_fin > p_hora_inicio)
  ORDER BY r.hora_inicio;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FUNCIÓN UTILIDAD: Estadísticas de cancelaciones
-- =====================================================

CREATE OR REPLACE FUNCTION obtener_estadisticas_cancelaciones_automaticas(
  p_dias_atras INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  v_total_cancelaciones INTEGER;
  v_usuarios_unicos INTEGER;
  v_cancelaciones_por_dia JSONB;
  v_estadisticas JSONB;
  v_fecha_limite DATE;
BEGIN
  v_fecha_limite := CURRENT_DATE - p_dias_atras;
  
  -- Contar cancelaciones automáticas en el período
  SELECT COUNT(*) INTO v_total_cancelaciones
  FROM reservas
  WHERE estado = 'cancelada'
    AND motivo_rechazo = 'Conflicto con horario académico programado'
    AND ultima_actualizacion >= v_fecha_limite;
  
  -- Contar usuarios únicos afectados
  SELECT COUNT(DISTINCT usuario_id) INTO v_usuarios_unicos
  FROM reservas
  WHERE estado = 'cancelada'
    AND motivo_rechazo = 'Conflicto con horario académico programado'
    AND ultima_actualizacion >= v_fecha_limite;
  
  -- Obtener cancelaciones por día
  SELECT jsonb_object_agg(fecha, total) INTO v_cancelaciones_por_dia
  FROM (
    SELECT 
      DATE(ultima_actualizacion) as fecha,
      COUNT(*) as total
    FROM reservas
    WHERE estado = 'cancelada'
      AND motivo_rechazo = 'Conflicto con horario académico programado'
      AND ultima_actualizacion >= v_fecha_limite
    GROUP BY DATE(ultima_actualizacion)
    ORDER BY fecha DESC
  ) sub;
  
  v_estadisticas := jsonb_build_object(
    'periodo_dias', p_dias_atras,
    'total_cancelaciones_automaticas', v_total_cancelaciones,
    'usuarios_unicos_afectados', v_usuarios_unicos,
    'promedio_cancelaciones_por_dia', ROUND(v_total_cancelaciones::DECIMAL / p_dias_atras, 2),
    'cancelaciones_por_dia', COALESCE(v_cancelaciones_por_dia, '{}'::jsonb),
    'timestamp', NOW()
  );
  
  RETURN v_estadisticas;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. FUNCIÓN UTILIDAD: Revertir cancelaciones (emergencia)
-- =====================================================

CREATE OR REPLACE FUNCTION revertir_cancelaciones_automaticas(
  p_fecha_desde DATE,
  p_fecha_hasta DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_reservas_revertidas INTEGER;
  v_fecha_fin DATE;
BEGIN
  v_fecha_fin := COALESCE(p_fecha_hasta, p_fecha_desde);
  
  -- Revertir cancelaciones automáticas en el rango de fechas
  UPDATE reservas
  SET 
    estado = 'pendiente',
    motivo_rechazo = NULL,
    comentario = REPLACE(comentario, ' | CANCELADA AUTOMÁTICAMENTE: Conflicto con', ' | REVERTIDA:'),
    ultima_actualizacion = NOW()
  WHERE estado = 'cancelada'
    AND motivo_rechazo = 'Conflicto con horario académico programado'
    AND fecha BETWEEN p_fecha_desde AND v_fecha_fin;
  
  GET DIAGNOSTICS v_reservas_revertidas = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'reservas_revertidas', v_reservas_revertidas,
    'fecha_desde', p_fecha_desde,
    'fecha_hasta', v_fecha_fin,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. COMENTARIOS Y PERMISOS
-- =====================================================

-- Agregar comentarios a las funciones
COMMENT ON FUNCTION detectar_conflictos_horarios IS 'Detecta reservas que se superponen con un horario específico';
COMMENT ON FUNCTION cancelar_reservas_conflictivas IS 'Cancela automáticamente reservas de usuarios que entran en conflicto con horarios del sistema';
COMMENT ON FUNCTION resolver_conflictos_automatico IS 'Función trigger que resuelve conflictos automáticamente al crear reservas del sistema';
COMMENT ON FUNCTION simular_conflictos_horarios IS 'Simula qué reservas serían canceladas sin ejecutar la cancelación';
COMMENT ON FUNCTION obtener_estadisticas_cancelaciones_automaticas IS 'Obtiene estadísticas de cancelaciones automáticas en un período';
COMMENT ON FUNCTION revertir_cancelaciones_automaticas IS 'Revierte cancelaciones automáticas en caso de emergencia';

-- =====================================================
-- 9. VALIDACIÓN FINAL
-- =====================================================

-- Verificar que todas las funciones fueron creadas
SELECT 
  'Funciones creadas correctamente' as estado,
  COUNT(*) as total_funciones
FROM information_schema.routines 
WHERE routine_name IN (
  'detectar_conflictos_horarios',
  'cancelar_reservas_conflictivas', 
  'resolver_conflictos_automatico',
  'simular_conflictos_horarios',
  'obtener_estadisticas_cancelaciones_automaticas',
  'revertir_cancelaciones_automaticas'
);

-- Verificar que el trigger fue creado
SELECT 
  'Trigger creado correctamente' as estado,
  trigger_name
FROM information_schema.triggers 
WHERE trigger_name = 'resolver_conflictos_horarios_trigger';

-- =====================================================
-- SISTEMA LISTO PARA USO
-- =====================================================
-- El sistema de resolución automática de conflictos está ahora activo.
-- Cada vez que se cree una reserva del sistema (es_reserva_sistema = true),
-- automáticamente cancelará las reservas de usuarios conflictivas y 
-- enviará notificaciones explicativas.
-- ===================================================== 