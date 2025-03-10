-- Script completo para solucionar el problema de ambigüedad en la columna "fecha"
-- Este script contiene todas las funciones necesarias para el componente de disponibilidad

-- 1. Función básica para obtener disponibilidad (versión simple)
CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes(
  p_sala_id INTEGER,
  p_anio INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (
  fecha DATE,
  disponible BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_dia DATE;
  v_disponible BOOLEAN;
BEGIN
  -- Definir el rango de fechas para el mes especificado
  v_fecha_inicio := DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1));
  v_fecha_fin := (DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Iterar por cada día del mes
  FOR v_dia IN SELECT generate_series(v_fecha_inicio, v_fecha_fin, '1 day'::interval)::DATE LOOP
    -- Verificar si hay reservas para este día y sala
    SELECT NOT EXISTS (
      SELECT 1
      FROM reservas r
      WHERE r.sala_id = p_sala_id
        AND r.fecha = v_dia
        AND r.estado IN ('pendiente', 'aprobada')
    ) INTO v_disponible;
    
    -- Devolver el resultado para este día
    fecha := v_dia;
    disponible := v_disponible;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- 2. Función mejorada para obtener disponibilidad (versión con bloques)
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
BEGIN
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
      -- Iterar por cada bloque de 30 minutos entre 8:00 y 19:00
      FOR v_hora_inicio IN 
        SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
        FROM generate_series(0, (11*60/v_intervalo_minutos)::INTEGER - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '19:00:00'::TIME
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
        FROM generate_series(0, (11*60/v_intervalo_minutos)::INTEGER - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '19:00:00'::TIME
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

-- 3. Función para obtener disponibilidad en formato JSON (versión corregida)
CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes_json(
  p_sala_id INTEGER,
  p_anio INTEGER,
  p_mes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_resultado JSONB;
  v_dias_array JSONB := '[]'::JSONB;
  v_disponibilidad RECORD;
BEGIN
  -- Obtener la disponibilidad usando la función existente
  FOR v_disponibilidad IN 
    SELECT d.fecha, d.disponible, d.bloques_disponibles, d.bloques_totales 
    FROM public.obtener_disponibilidad_sala_mes_v2(p_sala_id, p_anio, p_mes) d
  LOOP
    -- Agregar cada día al array JSON
    v_dias_array := v_dias_array || jsonb_build_object(
      'fecha', to_char(v_disponibilidad.fecha, 'YYYY-MM-DD'),
      'dia', EXTRACT(DAY FROM v_disponibilidad.fecha),
      'dia_semana', EXTRACT(DOW FROM v_disponibilidad.fecha),
      'disponible', v_disponibilidad.disponible,
      'bloques_disponibles', v_disponibilidad.bloques_disponibles,
      'bloques_totales', v_disponibilidad.bloques_totales,
      'porcentaje_disponibilidad', 
        CASE 
          WHEN v_disponibilidad.bloques_totales > 0 
          THEN ROUND((v_disponibilidad.bloques_disponibles::NUMERIC / v_disponibilidad.bloques_totales) * 100, 2)
          ELSE 0
        END
    );
  END LOOP;
  
  -- Obtener información de la sala
  SELECT jsonb_build_object(
    'id', s.id,
    'nombre', s.nombre,
    'tipo', s.tipo,
    'capacidad', s.capacidad,
    'centro', s.centro
  ) INTO v_resultado
  FROM salas s
  WHERE s.id = p_sala_id;
  
  -- Construir el objeto JSON final
  v_resultado := jsonb_build_object(
    'sala', v_resultado,
    'anio', p_anio,
    'mes', p_mes,
    'nombre_mes', to_char(MAKE_DATE(p_anio, p_mes, 1), 'TMMonth'),
    'dias', v_dias_array,
    'dias_disponibles', (SELECT COUNT(*) FROM jsonb_array_elements(v_dias_array) WHERE (value->>'disponible')::BOOLEAN = TRUE),
    'dias_totales', jsonb_array_length(v_dias_array)
  );
  
  RETURN v_resultado;
END;
$$;

-- 4. Función alternativa para obtener disponibilidad en formato JSON (versión independiente)
CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes_json_v2(
  p_sala_id INTEGER,
  p_anio INTEGER,
  p_mes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_resultado JSONB;
  v_dias_array JSONB := '[]'::JSONB;
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_dia DATE;
  v_disponible BOOLEAN;
  v_sala RECORD;
  v_dias_disponibles INTEGER := 0;
  v_dias_totales INTEGER := 0;
BEGIN
  -- Definir el rango de fechas para el mes especificado
  v_fecha_inicio := DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1));
  v_fecha_fin := (DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Obtener información de la sala
  SELECT s.id, s.nombre, s.tipo, s.capacidad, s.centro
  INTO v_sala
  FROM salas s
  WHERE s.id = p_sala_id;
  
  -- Construir el objeto JSON de la sala
  v_resultado := jsonb_build_object(
    'id', v_sala.id,
    'nombre', v_sala.nombre,
    'tipo', v_sala.tipo,
    'capacidad', v_sala.capacidad,
    'centro', v_sala.centro
  );
  
  -- Iterar por cada día del mes
  FOR v_dia IN SELECT generate_series(v_fecha_inicio, v_fecha_fin, '1 day'::interval)::DATE LOOP
    -- Verificar si hay reservas para este día y sala
    SELECT NOT EXISTS (
      SELECT 1
      FROM reservas r
      WHERE r.sala_id = p_sala_id
        AND r.fecha = v_dia
        AND r.estado IN ('pendiente', 'aprobada')
    ) INTO v_disponible;
    
    -- Incrementar contadores
    v_dias_totales := v_dias_totales + 1;
    IF v_disponible THEN
      v_dias_disponibles := v_dias_disponibles + 1;
    END IF;
    
    -- Agregar día al array JSON
    v_dias_array := v_dias_array || jsonb_build_object(
      'fecha', to_char(v_dia, 'YYYY-MM-DD'),
      'dia', EXTRACT(DAY FROM v_dia),
      'dia_semana', EXTRACT(DOW FROM v_dia),
      'disponible', v_disponible,
      'bloques_disponibles', CASE WHEN v_disponible THEN 22 ELSE 0 END,
      'bloques_totales', 22,
      'porcentaje_disponibilidad', CASE WHEN v_disponible THEN 100 ELSE 0 END
    );
  END LOOP;
  
  -- Construir el objeto JSON final
  v_resultado := jsonb_build_object(
    'sala', v_resultado,
    'anio', p_anio,
    'mes', p_mes,
    'nombre_mes', to_char(MAKE_DATE(p_anio, p_mes, 1), 'TMMonth'),
    'dias', v_dias_array,
    'dias_disponibles', v_dias_disponibles,
    'dias_totales', v_dias_totales
  );
  
  RETURN v_resultado;
END;
$$; 