-- Solución alternativa para el problema de ambigüedad en la columna "fecha"
-- Esta versión no depende de otras funciones y es completamente independiente

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