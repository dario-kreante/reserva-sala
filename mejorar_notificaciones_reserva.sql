-- Script para mejorar el texto de las notificaciones de reservas pendientes

-- 1. Primero, crear una función para generar notificaciones de reservas
CREATE OR REPLACE FUNCTION crear_notificacion_reserva()
RETURNS TRIGGER AS $$
DECLARE
  v_sala_nombre TEXT;
  v_fecha_formateada TEXT;
  v_hora_inicio TEXT;
  v_hora_fin TEXT;
  v_contenido TEXT;
  v_tipo TEXT;
BEGIN
  -- Obtener el nombre de la sala
  SELECT nombre INTO v_sala_nombre
  FROM salas
  WHERE id = NEW.sala_id;
  
  -- Formatear la fecha y hora para mejor legibilidad
  v_fecha_formateada := TO_CHAR(NEW.fecha, 'DD/MM/YYYY');
  v_hora_inicio := TO_CHAR(NEW.hora_inicio::time, 'HH24:MI');
  v_hora_fin := TO_CHAR(NEW.hora_fin::time, 'HH24:MI');
  
  -- Determinar el tipo de notificación según el estado de la reserva
  IF TG_OP = 'INSERT' THEN
    -- Para nuevas reservas (siempre pendientes)
    v_tipo := 'reserva';
    v_contenido := 'Su reserva en la sala ' || v_sala_nombre || ' para el día ' || 
                  v_fecha_formateada || ' de ' || v_hora_inicio || ' a ' || v_hora_fin || 
                  ' ha sido registrada y está pendiente de aprobación.';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para actualizaciones de estado
    IF NEW.estado = 'aprobada' AND OLD.estado != 'aprobada' THEN
      v_tipo := 'reserva';
      v_contenido := '¡Su reserva ha sido aprobada! Sala ' || v_sala_nombre || 
                    ' para el día ' || v_fecha_formateada || ' de ' || 
                    v_hora_inicio || ' a ' || v_hora_fin || '.';
    ELSIF NEW.estado = 'rechazada' AND OLD.estado != 'rechazada' THEN
      v_tipo := 'alerta';
      v_contenido := 'Su reserva en la sala ' || v_sala_nombre || ' para el día ' || 
                    v_fecha_formateada || ' ha sido rechazada.';
    ELSIF NEW.estado = 'cancelada' AND OLD.estado != 'cancelada' THEN
      v_tipo := 'sistema';
      v_contenido := 'Su reserva en la sala ' || v_sala_nombre || ' para el día ' || 
                    v_fecha_formateada || ' ha sido cancelada.';
    ELSE
      -- No crear notificación para otros cambios
      RETURN NEW;
    END IF;
  END IF;
  
  -- Insertar la notificación
  INSERT INTO notificaciones (usuario_id, tipo, contenido)
  VALUES (NEW.usuario_id, v_tipo, v_contenido);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear o reemplazar el trigger para nuevas reservas
DROP TRIGGER IF EXISTS crear_notificacion_nueva_reserva ON reservas;
CREATE TRIGGER crear_notificacion_nueva_reserva
AFTER INSERT ON reservas
FOR EACH ROW
EXECUTE FUNCTION crear_notificacion_reserva();

-- 3. Crear o reemplazar el trigger para actualizaciones de reservas
DROP TRIGGER IF EXISTS crear_notificacion_actualizacion_reserva ON reservas;
CREATE TRIGGER crear_notificacion_actualizacion_reserva
AFTER UPDATE OF estado ON reservas
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION crear_notificacion_reserva();

-- 4. Actualizar las notificaciones existentes de reservas pendientes
UPDATE notificaciones
SET contenido = REPLACE(
  contenido,
  'Su reserva para',
  'Su reserva en'
)
WHERE tipo = 'reserva_pendiente' OR contenido LIKE '%pendiente de aprobación%';

-- 5. Actualizar el formato de las notificaciones existentes de reservas pendientes
UPDATE notificaciones
SET contenido = REGEXP_REPLACE(
  contenido,
  'Su reserva en (.*) el ([0-9]{4}-[0-9]{2}-[0-9]{2}) está pendiente de aprobación.',
  'Su reserva en \1 para el día ' || TO_CHAR(TO_DATE(SUBSTRING(REGEXP_REPLACE(contenido, 'Su reserva en (.*) el ([0-9]{4}-[0-9]{2}-[0-9]{2}) está pendiente de aprobación.', '\2'), '[0-9]{4}-[0-9]{2}-[0-9]{2}'), 'YYYY-MM-DD'), 'DD/MM/YYYY') || ' ha sido registrada y está pendiente de aprobación.'
)
WHERE tipo = 'reserva_pendiente' OR contenido LIKE '%pendiente de aprobación%'; 