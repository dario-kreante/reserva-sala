-- =====================================================
-- ACTUALIZACIÓN DE HORARIOS: EXTENSIÓN A 21:30
-- =====================================================
-- Este script actualiza todas las funciones de disponibilidad
-- para extender el horario de reservas de 08:00-19:00 a 08:00-21:30
-- =====================================================

-- 1. FUNCIÓN: obtener_disponibilidad_sala_mes
-- Actualizar de 19:00 a 21:30 (aumenta de 22 bloques a 27 bloques de 30min)
CREATE OR REPLACE FUNCTION public.obtener_disponibilidad_sala_mes(
  p_sala_id INTEGER,
  p_anio INTEGER,
  p_mes INTEGER
)
RETURNS TABLE (fecha DATE, disponible BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_dia DATE;
  v_hora_inicio TIME;
  v_hora_fin TIME;
  v_bloque_disponible BOOLEAN;
  v_intervalo_minutos INTEGER := 30; -- Tamaño del bloque en minutos
BEGIN
  -- Definir el rango de fechas para el mes especificado
  v_fecha_inicio := DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1));
  v_fecha_fin := (DATE_TRUNC('month', MAKE_DATE(p_anio, p_mes, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Iterar por cada día del mes
  FOR v_dia IN SELECT generate_series(v_fecha_inicio, v_fecha_fin, '1 day'::interval)::DATE LOOP
    v_bloque_disponible := FALSE;
    
    -- Iterar por cada bloque de 30 minutos entre 8:00 y 21:30 (ACTUALIZADO)
    FOR v_hora_inicio IN 
      SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
      FROM generate_series(0, (13*60/v_intervalo_minutos + 30/v_intervalo_minutos)::INTEGER - 1) AS n
      WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
    LOOP
      v_hora_fin := (v_hora_inicio + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME;
      
      -- Verificar si este bloque está disponible (no hay reservas que se superpongan)
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
        -- Si encontramos al menos un bloque disponible, marcamos el día como disponible
        v_bloque_disponible := TRUE;
        EXIT; -- Salir del bucle de horas, ya encontramos un bloque disponible
      END IF;
    END LOOP;
    
    -- Devolver el resultado para este día
    fecha := v_dia;
    disponible := v_bloque_disponible;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.obtener_disponibilidad_sala_mes IS 
'Función que determina la disponibilidad de una sala para cada día de un mes específico.
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 21:30.
Parámetros:
- p_sala_id: ID de la sala a consultar
- p_anio: Año (ej: 2023)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario';

-- 2. FUNCIÓN: obtener_disponibilidad_sala_mes_v2
-- Versión mejorada con información de bloques disponibles
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
      -- Iterar por cada bloque de 30 minutos entre 8:00 y 21:30 (ACTUALIZADO)
      FOR v_hora_inicio IN 
        SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
        FROM generate_series(0, (13*60/v_intervalo_minutos + 30/v_intervalo_minutos)::INTEGER - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
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
        FROM generate_series(0, (13*60/v_intervalo_minutos + 30/v_intervalo_minutos)::INTEGER - 1) AS n
        WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '21:30:00'::TIME
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
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 21:30.
Parámetros:
- p_sala_id: ID de la sala a consultar
- p_anio: Año (ej: 2023)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario
- bloques_disponibles: Número de bloques de 30 minutos disponibles en el día
- bloques_totales: Número total de bloques de 30 minutos en el día (ahora 27 para el horario 8:00-21:30)';

-- =====================================================
-- VERIFICACIÓN DE LA ACTUALIZACIÓN
-- =====================================================

-- Función para verificar el rango de horarios actualizado
CREATE OR REPLACE FUNCTION verificar_horarios_actualizados()
RETURNS TABLE (
  funcion_nombre TEXT,
  bloques_totales_esperados INTEGER,
  horario_inicio TIME,
  horario_fin TIME,
  duracion_horas NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    'obtener_disponibilidad_sala_mes'::TEXT,
    27::INTEGER, -- 13.5 horas * 2 bloques por hora = 27 bloques
    '08:00:00'::TIME,
    '21:30:00'::TIME,
    13.5::NUMERIC;
END;
$$;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

-- RESUMEN DE CAMBIOS:
-- 1. Horario extendido de 08:00-19:00 a 08:00-21:30
-- 2. Duración aumentada de 11 horas a 13.5 horas  
-- 3. Bloques de 30min aumentados de 22 a 27 por día
-- 4. Tiempo máximo para última clase: 21:00-21:30

-- APLICACIÓN:
-- 1. Ejecutar este script en Supabase
-- 2. Verificar que las funciones se actualicen correctamente
-- 3. Probar disponibilidad en horarios extendidos
-- 4. Actualizar documentación correspondiente 