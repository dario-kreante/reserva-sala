-- Script para corregir la ambigüedad de la columna "fecha" en la función obtener_disponibilidad_sala_mes_json

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