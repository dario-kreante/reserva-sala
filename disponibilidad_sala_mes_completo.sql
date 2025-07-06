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
          FROM reservas
          WHERE sala_id = p_sala_id
            AND fecha = v_dia
            AND estado IN ('pendiente', 'aprobada')
            AND (
              (hora_inicio <= v_hora_inicio AND hora_fin > v_hora_inicio) OR
              (hora_inicio < v_hora_fin AND hora_fin >= v_hora_fin) OR
              (hora_inicio >= v_hora_inicio AND hora_fin <= v_hora_fin)
            )
          UNION ALL
          -- Verificar horarios fijos (tabla horarios)
          SELECT 1
          FROM horarios
          WHERE sala_id = p_sala_id
            AND (
              -- Para horarios de tipo 'unico'
              (recurrencia = 'unico' AND fecha = v_dia) OR
              -- Para horarios semanales, verificar el día de la semana
              (recurrencia = 'semanal' AND EXTRACT(DOW FROM fecha) = v_dia_semana AND
               fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos WHERE id = horarios.periodo_id AND fecha_fin >= v_dia)) OR
              -- Para horarios mensuales, verificar el día del mes
              (recurrencia = 'mensual' AND EXTRACT(DAY FROM fecha) = EXTRACT(DAY FROM v_dia) AND
               fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos WHERE id = horarios.periodo_id AND fecha_fin >= v_dia))
            )
            AND (
              (hora_inicio <= v_hora_inicio AND hora_fin > v_hora_inicio) OR
              (hora_inicio < v_hora_fin AND hora_fin >= v_hora_fin) OR
              (hora_inicio >= v_hora_inicio AND hora_fin <= v_hora_fin)
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
          FROM reservas
          WHERE sala_id = p_sala_id
            AND fecha = v_dia
            AND estado IN ('pendiente', 'aprobada')
            AND (
              (hora_inicio <= v_hora_inicio AND hora_fin > v_hora_inicio) OR
              (hora_inicio < v_hora_fin AND hora_fin >= v_hora_fin) OR
              (hora_inicio >= v_hora_inicio AND hora_fin <= v_hora_fin)
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

COMMENT ON FUNCTION public.obtener_disponibilidad_sala_mes IS 
'Función que determina la disponibilidad de una sala para cada día de un mes específico.
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 19:00.
Parámetros:
- p_sala_id: ID de la sala a consultar
- p_anio: Año (ej: 2023)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario'; CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes_v2(
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
          FROM reservas
          WHERE sala_id = p_sala_id
            AND fecha = v_dia
            AND estado IN ('pendiente', 'aprobada')
            AND (
              (hora_inicio <= v_hora_inicio AND hora_fin > v_hora_inicio) OR
              (hora_inicio < v_hora_fin AND hora_fin >= v_hora_fin) OR
              (hora_inicio >= v_hora_inicio AND hora_fin <= v_hora_fin)
            )
          UNION ALL
          -- Verificar horarios fijos (tabla horarios)
          SELECT 1
          FROM horarios
          WHERE sala_id = p_sala_id
            AND (
              -- Para horarios de tipo 'unico'
              (recurrencia = 'unico' AND fecha = v_dia) OR
              -- Para horarios semanales, verificar el día de la semana
              (recurrencia = 'semanal' AND EXTRACT(DOW FROM fecha) = v_dia_semana AND
               fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos WHERE id = horarios.periodo_id AND fecha_fin >= v_dia)) OR
              -- Para horarios mensuales, verificar el día del mes
              (recurrencia = 'mensual' AND EXTRACT(DAY FROM fecha) = EXTRACT(DAY FROM v_dia) AND
               fecha <= v_dia AND
               EXISTS (SELECT 1 FROM periodos WHERE id = horarios.periodo_id AND fecha_fin >= v_dia))
            )
            AND (
              (hora_inicio <= v_hora_inicio AND hora_fin > v_hora_inicio) OR
              (hora_inicio < v_hora_fin AND hora_fin >= v_hora_fin) OR
              (hora_inicio >= v_hora_inicio AND hora_fin <= v_hora_fin)
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
          FROM reservas
          WHERE sala_id = p_sala_id
            AND fecha = v_dia
            AND estado IN ('pendiente', 'aprobada')
            AND (
              (hora_inicio <= v_hora_inicio AND hora_fin > v_hora_inicio) OR
              (hora_inicio < v_hora_fin AND hora_fin >= v_hora_fin) OR
              (hora_inicio >= v_hora_inicio AND hora_fin <= v_hora_fin)
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

COMMENT ON FUNCTION public.obtener_disponibilidad_sala_mes_v2 IS 
'Función mejorada que determina la disponibilidad de una sala para cada día de un mes específico.
Considera tanto las reservas como los horarios fijos (clases, eventos recurrentes, etc.).
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 19:00.
Parámetros:
- p_sala_id: ID de la sala a consultar
- p_anio: Año (ej: 2023)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario
- bloques_disponibles: Número de bloques de 30 minutos disponibles en el día
- bloques_totales: Número total de bloques de 30 minutos en el día (normalmente 22 para el horario 8:00-19:00)'; CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes_json(
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
    SELECT * FROM public.obtener_disponibilidad_sala_mes_v2(p_sala_id, p_anio, p_mes)
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

COMMENT ON FUNCTION public.obtener_disponibilidad_sala_mes_json IS 
'Función que devuelve la disponibilidad de una sala para un mes específico en formato JSON.
Utiliza la función obtener_disponibilidad_sala_mes_v2 internamente.
Parámetros:
- p_sala_id: ID de la sala a consultar
- p_anio: Año (ej: 2023)
- p_mes: Mes (1-12)
Retorna un objeto JSON con:
- sala: Información de la sala (id, nombre, tipo, capacidad, centro)
- anio: Año consultado
- mes: Mes consultado (número)
- nombre_mes: Nombre del mes en español
- dias: Array con la disponibilidad de cada día del mes
  - fecha: Fecha en formato YYYY-MM-DD
  - dia: Día del mes (1-31)
  - dia_semana: Día de la semana (0=domingo, 6=sábado)
  - disponible: TRUE si hay al menos un bloque de 30 minutos disponible
  - bloques_disponibles: Número de bloques de 30 minutos disponibles
  - bloques_totales: Número total de bloques de 30 minutos (8:00-19:00)
  - porcentaje_disponibilidad: Porcentaje de bloques disponibles
- dias_disponibles: Número total de días disponibles en el mes
- dias_totales: Número total de días en el mes'; 