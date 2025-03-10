-- Script para corregir la ambigüedad de la columna "fecha" en la función obtener_disponibilidad_sala_mes_json
-- Esta versión es más simple y directa para resolver el problema específico

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
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_sala RECORD;
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
  FOR v_disponibilidad IN 
    WITH dias AS (
      SELECT generate_series(v_fecha_inicio, v_fecha_fin, '1 day'::interval)::DATE AS dia
    ),
    reservas_por_dia AS (
      SELECT 
        d.dia,
        CASE WHEN COUNT(r.id) > 0 THEN FALSE ELSE TRUE END AS disponible
      FROM dias d
      LEFT JOIN reservas r ON r.fecha = d.dia AND r.sala_id = p_sala_id AND r.estado IN ('pendiente', 'aprobada')
      GROUP BY d.dia
    )
    SELECT 
      rpd.dia AS fecha,
      rpd.disponible,
      CASE WHEN rpd.disponible THEN 22 ELSE 0 END AS bloques_disponibles,
      22 AS bloques_totales
    FROM reservas_por_dia rpd
    ORDER BY rpd.dia
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