-- Migración 004: Agregar estado 'vencida' y cron job para reservas vencidas
-- Fecha: 2024-12-19
-- Descripción: Agrega estado 'vencida' para reservas pendientes con fechas pasadas y automatiza su procesamiento

-- PASO 1: Agregar el nuevo estado 'vencida' al constraint
ALTER TABLE reservas 
DROP CONSTRAINT IF EXISTS reservas_estado_check;

ALTER TABLE reservas 
ADD CONSTRAINT reservas_estado_check 
CHECK (estado::text = ANY (ARRAY[
  'pendiente'::character varying::text, 
  'aprobada'::character varying::text, 
  'rechazada'::character varying::text, 
  'cancelada'::character varying::text,
  'vencida'::character varying::text
]));

-- PASO 2: Crear función para marcar reservas como vencidas
CREATE OR REPLACE FUNCTION marcar_reservas_vencidas()
RETURNS TABLE(
  reservas_actualizadas integer,
  detalles jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_actualizadas integer := 0;
  detalles_result jsonb := '[]'::jsonb;
  reserva_record record;
BEGIN
  -- Log del inicio del proceso
  RAISE NOTICE 'Iniciando proceso de marcado de reservas vencidas a las %', NOW();
  
  -- Obtener y procesar reservas pendientes vencidas
  FOR reserva_record IN
    SELECT 
      r.id,
      r.fecha,
      r.hora_inicio,
      r.hora_fin,
      s.nombre as sala_nombre,
      u.nombre || ' ' || u.apellido as usuario_nombre,
      r.created_at
    FROM reservas r
    LEFT JOIN salas s ON r.sala_id = s.id
    LEFT JOIN usuarios u ON r.usuario_id = u.id
    WHERE r.estado = 'pendiente'
      AND (
        r.fecha < CURRENT_DATE 
        OR (r.fecha = CURRENT_DATE AND r.hora_fin < CURRENT_TIME)
      )
  LOOP
    -- Marcar la reserva como vencida
    UPDATE reservas 
    SET 
      estado = 'vencida',
      ultima_actualizacion = NOW(),
      motivo_rechazo = COALESCE(
        motivo_rechazo, 
        'Reserva vencida automáticamente - Fecha/hora ya pasó sin aprobación'
      )
    WHERE id = reserva_record.id;
    
    -- Incrementar contador
    total_actualizadas := total_actualizadas + 1;
    
    -- Agregar detalles al resultado
    detalles_result := detalles_result || jsonb_build_object(
      'reserva_id', reserva_record.id,
      'fecha', reserva_record.fecha,
      'hora_inicio', reserva_record.hora_inicio,
      'hora_fin', reserva_record.hora_fin,
      'sala', reserva_record.sala_nombre,
      'usuario', reserva_record.usuario_nombre,
      'fecha_creacion', reserva_record.created_at,
      'fecha_vencimiento', NOW()
    );
    
    RAISE NOTICE 'Reserva % marcada como vencida - Sala: %, Usuario: %, Fecha: %', 
      reserva_record.id, 
      reserva_record.sala_nombre, 
      reserva_record.usuario_nombre, 
      reserva_record.fecha;
  END LOOP;
  
  RAISE NOTICE 'Proceso completado. Total de reservas marcadas como vencidas: %', total_actualizadas;
  
  -- Retornar resultados
  RETURN QUERY SELECT total_actualizadas, detalles_result;
END;
$$;

-- PASO 3: Crear función wrapper para el cron job
CREATE OR REPLACE FUNCTION cron_marcar_reservas_vencidas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado record;
BEGIN
  -- Ejecutar la función principal
  SELECT * INTO resultado FROM marcar_reservas_vencidas();
  
  -- Log del resultado
  INSERT INTO logs_sistema (
    tipo_operacion,
    descripcion,
    detalles,
    fecha_creacion
  ) VALUES (
    'cron_reservas_vencidas',
    format('Procesamiento automático completado. %s reservas marcadas como vencidas.', resultado.reservas_actualizadas),
    resultado.detalles,
    NOW()
  );
END;
$$;

-- PASO 4: Crear tabla de logs si no existe
CREATE TABLE IF NOT EXISTS logs_sistema (
  id bigserial PRIMARY KEY,
  tipo_operacion varchar(100) NOT NULL,
  descripcion text,
  detalles jsonb,
  fecha_creacion timestamptz DEFAULT NOW()
);

-- PASO 5: Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_reservas_estado_fecha 
ON reservas(estado, fecha) 
WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_logs_sistema_tipo_fecha 
ON logs_sistema(tipo_operacion, fecha_creacion);

-- PASO 6: Configurar el cron job (ejecutar diariamente a las 2:00 AM)
-- Nota: Esto requiere la extensión pg_cron
SELECT cron.schedule(
  'marcar-reservas-vencidas',
  '0 2 * * *',  -- Todos los días a las 2:00 AM
  'SELECT cron_marcar_reservas_vencidas();'
);

-- PASO 7: Ejecutar inmediatamente para limpiar datos existentes
SELECT marcar_reservas_vencidas();

-- PASO 8: Agregar comentarios para documentación
COMMENT ON FUNCTION marcar_reservas_vencidas() IS 
'Función que marca como vencidas las reservas pendientes cuya fecha/hora ya pasó. Retorna el número de reservas actualizadas y sus detalles.';

COMMENT ON FUNCTION cron_marcar_reservas_vencidas() IS 
'Wrapper para el cron job que ejecuta marcar_reservas_vencidas() y registra el resultado en logs_sistema.';

COMMENT ON TABLE logs_sistema IS 
'Tabla para registrar logs de operaciones automáticas del sistema, especialmente para cron jobs.'; 