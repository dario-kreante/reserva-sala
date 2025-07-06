-- Script completo para filtrar salas inactivas en todas las funciones de disponibilidad
-- Aplicar en Supabase SQL Editor

-- 1. Actualizar función obtener_disponibilidad_sala_mes_v2
CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes_v2(
  p_sala_id INTEGER,
  p_anio INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  fecha DATE,
  disponible BOOLEAN,
  bloques_disponibles INTEGER,
  bloques_totales INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_dia DATE;
  v_dia_semana INTEGER;
  v_hora_inicio TIME;
  v_hora_fin TIME;
  v_bloques_disponibles INTEGER;
  v_bloques_totales INTEGER;
  v_intervalo_minutos INTEGER := 30; -- Tamaño del bloque en minutos
  v_sala_activa BOOLEAN;
BEGIN
  -- Verificar que la sala existe y está activa
  SELECT activo INTO v_sala_activa
  FROM salas 
  WHERE id = p_sala_id;
  
  -- Si la sala no existe o está inactiva, no devolver ningún resultado
  IF v_sala_activa IS NULL OR v_sala_activa = FALSE THEN
    RETURN;
  END IF;

  -- Definir el rango de fechas para el mes especificado
  v_fecha_inicio := DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1));
  v_fecha_fin := (DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Iterar por cada día del mes
  FOR v_dia IN SELECT generate_series(v_fecha_inicio, v_fecha_fin, '1 day'::interval)::DATE LOOP
    v_dia_semana := EXTRACT(DOW FROM v_dia); -- 0 = domingo, 1 = lunes, ..., 6 = sábado
    v_bloques_disponibles := 0;
    v_bloques_totales := 0;
    
    -- Verificar si hay horarios fijos para este día (por ejemplo, horarios de clase)
    -- Si es fin de semana (sábado o domingo), asumimos que no hay horarios fijos
    IF v_dia_semana BETWEEN 1 AND 5 THEN
      -- Iterar por cada bloque de 30 minutos entre 8:00 y 21:30
      FOR v_hora_inicio IN 
        SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
        FROM generate_series(0, (13*60/v_intervalo_minutos)::INTEGER + 1 - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
      LOOP
        v_hora_fin := (v_hora_inicio + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME;
        v_bloques_totales := v_bloques_totales + 1;
        
        -- Verificar si este bloque está disponible (no hay reservas ni horarios fijos que se superpongan)
        IF NOT EXISTS (
          -- Verificar reservas
          SELECT 1
          FROM reservas r
          WHERE r.sala_id = p_sala_id
            AND r.fecha = v_dia
            AND r.estado IN ('pendiente', 'aprobada')
            AND (
              (r.hora_inicio <= v_hora_inicio AND r.hora_fin > v_hora_inicio) OR
              (r.hora_inicio < v_hora_fin AND r.hora_fin >= v_hora_fin) OR
              (r.hora_inicio >= v_hora_inicio AND r.hora_fin <= v_hora_fin)
            )
          UNION ALL
          -- Verificar horarios fijos (tabla horarios)
          SELECT 1
          FROM horarios h
          WHERE h.sala_id = p_sala_id
            AND (
              -- Para horarios de tipo 'unico'
              (h.recurrencia = 'unico' AND h.fecha = v_dia) OR
              -- Para horarios semanales, verificar el día de la semana
              (h.recurrencia = 'semanal' AND EXTRACT(DOW FROM h.fecha) = v_dia_semana AND
               h.fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos p WHERE p.id = h.periodo_id AND p.fecha_fin >= v_dia)) OR
              -- Para horarios mensuales, verificar el día del mes
              (h.recurrencia = 'mensual' AND EXTRACT(DAY FROM h.fecha) = EXTRACT(DAY FROM v_dia) AND
               h.fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos p WHERE p.id = h.periodo_id AND p.fecha_fin >= v_dia))
            )
            AND (
              (h.hora_inicio <= v_hora_inicio AND h.hora_fin > v_hora_inicio) OR
              (h.hora_inicio < v_hora_fin AND h.hora_fin >= v_hora_fin) OR
              (h.hora_inicio >= v_hora_inicio AND h.hora_fin <= v_hora_fin)
            )
        ) THEN
          -- Si el bloque está disponible, incrementamos el contador
          v_bloques_disponibles := v_bloques_disponibles + 1;
        END IF;
      END LOOP;
    ELSE
      -- Para fines de semana, asumimos que todos los bloques están disponibles
      -- a menos que haya reservas específicas
      FOR v_hora_inicio IN 
        SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
        FROM generate_series(0, (13*60/v_intervalo_minutos)::INTEGER + 1 - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
      LOOP
        v_hora_fin := (v_hora_inicio + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME;
        v_bloques_totales := v_bloques_totales + 1;
        
        -- Verificar solo reservas para fines de semana
        IF NOT EXISTS (
          SELECT 1
          FROM reservas r
          WHERE r.sala_id = p_sala_id
            AND r.fecha = v_dia
            AND r.estado IN ('pendiente', 'aprobada')
            AND (
              (r.hora_inicio <= v_hora_inicio AND r.hora_fin > v_hora_inicio) OR
              (r.hora_inicio < v_hora_fin AND r.hora_fin >= v_hora_fin) OR
              (r.hora_inicio >= v_hora_inicio AND r.hora_fin <= v_hora_fin)
            )
        ) THEN
          v_bloques_disponibles := v_bloques_disponibles + 1;
        END IF;
      END LOOP;
    END IF;
    
    -- Devolver el resultado para este día
    fecha := v_dia;
    disponible := v_bloques_disponibles >= 1; -- Al menos un bloque de 30 minutos disponible
    bloques_disponibles := v_bloques_disponibles;
    bloques_totales := v_bloques_totales;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- 2. Actualizar función obtener_disponibilidad_sala_mes (versión antigua)
CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes(
  p_sala_id INTEGER,
  p_anio INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  fecha DATE,
  disponible BOOLEAN,
  bloques_disponibles INTEGER,
  bloques_totales INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_dia DATE;
  v_dia_semana INTEGER;
  v_hora_inicio TIME;
  v_hora_fin TIME;
  v_bloques_disponibles INTEGER;
  v_bloques_totales INTEGER;
  v_intervalo_minutos INTEGER := 30; -- Tamaño del bloque en minutos
  v_sala_activa BOOLEAN;
BEGIN
  -- Verificar que la sala existe y está activa
  SELECT activo INTO v_sala_activa
  FROM salas 
  WHERE id = p_sala_id;
  
  -- Si la sala no existe o está inactiva, no devolver ningún resultado
  IF v_sala_activa IS NULL OR v_sala_activa = FALSE THEN
    RETURN;
  END IF;

  -- Definir el rango de fechas para el mes especificado
  v_fecha_inicio := DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1));
  v_fecha_fin := (DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Iterar por cada día del mes
  FOR v_dia IN SELECT generate_series(v_fecha_inicio, v_fecha_fin, '1 day'::interval)::DATE LOOP
    v_dia_semana := EXTRACT(DOW FROM v_dia); -- 0 = domingo, 1 = lunes, ..., 6 = sábado
    v_bloques_disponibles := 0;
    v_bloques_totales := 0;
    
    -- Verificar si hay horarios fijos para este día (por ejemplo, horarios de clase)
    -- Si es fin de semana (sábado o domingo), asumimos que no hay horarios fijos
    IF v_dia_semana BETWEEN 1 AND 5 THEN
      -- Iterar por cada bloque de 30 minutos entre 8:00 y 21:30
      FOR v_hora_inicio IN 
        SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
        FROM generate_series(0, (13*60/v_intervalo_minutos)::INTEGER + 1 - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
      LOOP
        v_hora_fin := (v_hora_inicio + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME;
        v_bloques_totales := v_bloques_totales + 1;
        
        -- Verificar si este bloque está disponible (no hay reservas ni horarios fijos que se superpongan)
        IF NOT EXISTS (
          -- Verificar reservas
          SELECT 1
          FROM reservas r
          WHERE r.sala_id = p_sala_id
            AND r.fecha = v_dia
            AND r.estado IN ('pendiente', 'aprobada')
            AND (
              (r.hora_inicio <= v_hora_inicio AND r.hora_fin > v_hora_inicio) OR
              (r.hora_inicio < v_hora_fin AND r.hora_fin >= v_hora_fin) OR
              (r.hora_inicio >= v_hora_inicio AND r.hora_fin <= v_hora_fin)
            )
          UNION ALL
          -- Verificar horarios fijos (tabla horarios)
          SELECT 1
          FROM horarios h
          WHERE h.sala_id = p_sala_id
            AND (
              -- Para horarios de tipo 'unico'
              (h.recurrencia = 'unico' AND h.fecha = v_dia) OR
              -- Para horarios semanales, verificar el día de la semana
              (h.recurrencia = 'semanal' AND EXTRACT(DOW FROM h.fecha) = v_dia_semana AND
               h.fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos p WHERE p.id = h.periodo_id AND p.fecha_fin >= v_dia)) OR
              -- Para horarios mensuales, verificar el día del mes
              (h.recurrencia = 'mensual' AND EXTRACT(DAY FROM h.fecha) = EXTRACT(DAY FROM v_dia) AND
               h.fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos p WHERE p.id = h.periodo_id AND p.fecha_fin >= v_dia))
            )
            AND (
              (h.hora_inicio <= v_hora_inicio AND h.hora_fin > v_hora_inicio) OR
              (h.hora_inicio < v_hora_fin AND h.hora_fin >= v_hora_fin) OR
              (h.hora_inicio >= v_hora_inicio AND h.hora_fin <= v_hora_fin)
            )
        ) THEN
          -- Si el bloque está disponible, incrementamos el contador
          v_bloques_disponibles := v_bloques_disponibles + 1;
        END IF;
      END LOOP;
    ELSE
      -- Para fines de semana, asumimos que todos los bloques están disponibles
      -- a menos que haya reservas específicas
      FOR v_hora_inicio IN 
        SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
        FROM generate_series(0, (13*60/v_intervalo_minutos)::INTEGER + 1 - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
      LOOP
        v_hora_fin := (v_hora_inicio + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME;
        v_bloques_totales := v_bloques_totales + 1;
        
        -- Verificar solo reservas para fines de semana
        IF NOT EXISTS (
          SELECT 1
          FROM reservas r
          WHERE r.sala_id = p_sala_id
            AND r.fecha = v_dia
            AND r.estado IN ('pendiente', 'aprobada')
            AND (
              (r.hora_inicio <= v_hora_inicio AND r.hora_fin > v_hora_inicio) OR
              (r.hora_inicio < v_hora_fin AND r.hora_fin >= v_hora_fin) OR
              (r.hora_inicio >= v_hora_inicio AND r.hora_fin <= v_hora_fin)
            )
        ) THEN
          v_bloques_disponibles := v_bloques_disponibles + 1;
        END IF;
      END LOOP;
    END IF;
    
    -- Devolver el resultado para este día
    fecha := v_dia;
    disponible := v_bloques_disponibles >= 1; -- Al menos un bloque de 30 minutos disponible
    bloques_disponibles := v_bloques_disponibles;
    bloques_totales := v_bloques_totales;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- 3. Comentarios actualizados
COMMENT ON FUNCTION public.obtener_disponibilidad_sala_mes_v2 IS 
'Función mejorada que determina la disponibilidad de una sala para cada día de un mes específico.
ACTUALIZADA: Solo procesa salas activas. Si la sala está desactivada, no devuelve ningún resultado.
Considera tanto las reservas como los horarios fijos (clases, eventos recurrentes, etc.).
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 21:30.
Parámetros:
- p_sala_id: ID de la sala a consultar (debe estar activa)
- p_anio: Año (ej: 2024)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario
- bloques_disponibles: Número de bloques de 30 minutos disponibles en el día
- bloques_totales: Número total de bloques de 30 minutos en el día (normalmente 27 para el horario 8:00-21:30)';

COMMENT ON FUNCTION public.obtener_disponibilidad_sala_mes IS 
'Función que determina la disponibilidad de una sala para cada día de un mes específico.
ACTUALIZADA: Solo procesa salas activas. Si la sala está desactivada, no devuelve ningún resultado.
Considera tanto las reservas como los horarios fijos (clases, eventos recurrentes, etc.).
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 21:30.
Parámetros:
- p_sala_id: ID de la sala a consultar (debe estar activa)
- p_anio: Año (ej: 2024)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario
- bloques_disponibles: Número de bloques de 30 minutos disponibles en el día
- bloques_totales: Número total de bloques de 30 minutos en el día (normalmente 27 para el horario 8:00-21:30)';

-- 4. Verificar que las funciones existen y funcionan correctamente
DO $$
BEGIN
  -- Test básico para verificar que las funciones se ejecutan sin error
  PERFORM obtener_disponibilidad_sala_mes_v2(1, 2024, 12);
  PERFORM obtener_disponibilidad_sala_mes(1, 2024, 12);
  
  RAISE NOTICE 'Funciones de disponibilidad actualizadas correctamente con filtro de salas activas';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error al verificar funciones: %', SQLERRM;
END $$; 