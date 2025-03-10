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
    
    -- Iterar por cada bloque de 30 minutos entre 8:00 y 19:00
    FOR v_hora_inicio IN 
      SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
      FROM generate_series(0, (11*60/v_intervalo_minutos)::INTEGER - 1) AS n
      WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '19:00:00'::TIME
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
Considera que un día está disponible si hay al menos un bloque de 30 minutos libre entre las 8:00 y las 19:00.
Parámetros:
- p_sala_id: ID de la sala a consultar
- p_anio: Año (ej: 2023)
- p_mes: Mes (1-12)
Retorna una tabla con:
- fecha: Fecha del día
- disponible: TRUE si hay al menos un bloque de 30 minutos disponible, FALSE en caso contrario'; 