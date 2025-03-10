-- Script para prevenir notificaciones duplicadas y mejorar el texto de las notificaciones de reservas
-- Versión 2.0

-- 1. Primero, corregir las notificaciones con contenido NULL
UPDATE notificaciones
SET contenido = 'Notificación del sistema'
WHERE contenido IS NULL;

-- 2. Eliminar notificaciones duplicadas existentes (mantener solo la más reciente)
WITH duplicados AS (
  SELECT id, usuario_id, tipo, contenido, created_at,
         ROW_NUMBER() OVER (PARTITION BY usuario_id, tipo, contenido ORDER BY created_at DESC) as rn
  FROM notificaciones
  WHERE tipo = 'reserva' OR tipo = 'reserva_pendiente'
)
DELETE FROM notificaciones
WHERE id IN (
  SELECT id FROM duplicados WHERE rn > 1
);

-- 3. Crear una función mejorada para generar notificaciones de reservas
-- Esta función verifica si ya existe una notificación similar antes de crear una nueva
CREATE OR REPLACE FUNCTION crear_notificacion_reserva()
RETURNS TRIGGER AS $$
DECLARE
  v_sala_nombre TEXT;
  v_fecha_formateada TEXT;
  v_hora_inicio TEXT;
  v_hora_fin TEXT;
  v_contenido TEXT;
  v_tipo TEXT;
  v_existe_notificacion BOOLEAN;
  v_motivo_rechazo TEXT;
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
                  
    -- Verificar si ya existe una notificación similar en los últimos 5 minutos
    SELECT EXISTS (
      SELECT 1 
      FROM notificaciones 
      WHERE usuario_id = NEW.usuario_id 
        AND tipo = v_tipo
        AND contenido LIKE '%' || v_sala_nombre || '%' || v_fecha_formateada || '%'
        AND created_at > NOW() - INTERVAL '5 minutes'
    ) INTO v_existe_notificacion;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para actualizaciones de estado
    IF NEW.estado = 'aprobada' AND OLD.estado != 'aprobada' THEN
      v_tipo := 'reserva';
      v_contenido := '¡Su reserva ha sido aprobada! Sala ' || v_sala_nombre || 
                    ' para el día ' || v_fecha_formateada || ' de ' || 
                    v_hora_inicio || ' a ' || v_hora_fin || '.';
    ELSIF NEW.estado = 'rechazada' AND OLD.estado != 'rechazada' THEN
      v_tipo := 'alerta';
      -- Preparar el motivo de rechazo si existe
      v_motivo_rechazo := '';
      IF NEW.comentario IS NOT NULL AND NEW.comentario != '' THEN
        v_motivo_rechazo := ' Motivo: ' || NEW.comentario;
      END IF;
      
      v_contenido := 'Su reserva en la sala ' || v_sala_nombre || ' para el día ' || 
                    v_fecha_formateada || ' de ' || v_hora_inicio || ' a ' || v_hora_fin || 
                    ' ha sido rechazada.' || v_motivo_rechazo;
    ELSIF NEW.estado = 'cancelada' AND OLD.estado != 'cancelada' THEN
      v_tipo := 'sistema';
      v_contenido := 'Su reserva en la sala ' || v_sala_nombre || ' para el día ' || 
                    v_fecha_formateada || ' ha sido cancelada.';
    ELSE
      -- No crear notificación para otros cambios
      RETURN NEW;
    END IF;
    
    -- Verificar si ya existe una notificación similar en los últimos 5 minutos
    SELECT EXISTS (
      SELECT 1 
      FROM notificaciones 
      WHERE usuario_id = NEW.usuario_id 
        AND tipo = v_tipo
        AND contenido LIKE '%' || v_sala_nombre || '%' || v_fecha_formateada || '%'
        AND created_at > NOW() - INTERVAL '5 minutes'
    ) INTO v_existe_notificacion;
  END IF;
  
  -- Solo insertar la notificación si no existe una similar reciente
  IF NOT v_existe_notificacion THEN
    INSERT INTO notificaciones (usuario_id, tipo, contenido)
    VALUES (NEW.usuario_id, v_tipo, v_contenido);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Desactivar el trigger existente de notificaciones para reservas (si existe)
-- Nota: Esto asume que hay un trigger existente que está causando duplicados
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notificacion_reserva_trigger' 
    AND tgrelid = 'reservas'::regclass
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS notificacion_reserva_trigger ON reservas';
  END IF;
END$$;

-- 5. Crear o reemplazar el trigger para nuevas reservas
DROP TRIGGER IF EXISTS crear_notificacion_nueva_reserva ON reservas;
CREATE TRIGGER crear_notificacion_nueva_reserva
AFTER INSERT ON reservas
FOR EACH ROW
EXECUTE FUNCTION crear_notificacion_reserva();

-- 6. Crear o reemplazar el trigger para actualizaciones de reservas
DROP TRIGGER IF EXISTS crear_notificacion_actualizacion_reserva ON reservas;
CREATE TRIGGER crear_notificacion_actualizacion_reserva
AFTER UPDATE OF estado ON reservas
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION crear_notificacion_reserva();

-- 7. Actualizar las notificaciones existentes de reservas pendientes (solo si tienen contenido)
UPDATE notificaciones
SET contenido = REPLACE(
  contenido,
  'Su reserva para',
  'Su reserva en'
)
WHERE (tipo = 'reserva_pendiente' OR contenido LIKE '%pendiente de aprobación%')
AND contenido IS NOT NULL;

-- 8. Actualizar el formato de las notificaciones existentes de reservas pendientes
-- Solo aplicar a las que coinciden con el patrón esperado
UPDATE notificaciones
SET contenido = REGEXP_REPLACE(
  contenido,
  'Su reserva en (.*) el ([0-9]{4}-[0-9]{2}-[0-9]{2}) está pendiente de aprobación.',
  'Su reserva en \1 para el día ' || TO_CHAR(TO_DATE(SUBSTRING(REGEXP_REPLACE(contenido, 'Su reserva en (.*) el ([0-9]{4}-[0-9]{2}-[0-9]{2}) está pendiente de aprobación.', '\2'), '[0-9]{4}-[0-9]{2}-[0-9]{2}'), 'YYYY-MM-DD'), 'DD/MM/YYYY') || ' ha sido registrada y está pendiente de aprobación.'
)
WHERE (tipo = 'reserva_pendiente' OR contenido LIKE '%pendiente de aprobación%')
AND contenido IS NOT NULL
AND contenido ~ 'Su reserva en .* el [0-9]{4}-[0-9]{2}-[0-9]{2} está pendiente de aprobación.';

-- 9. Actualizar el formato de las notificaciones con el mensaje específico del problema
UPDATE notificaciones
SET contenido = REGEXP_REPLACE(
  contenido,
  'Su reserva en la sala ([0-9]+) ha sido pendiente',
  'Su reserva en la sala \1 ha sido registrada y está pendiente de aprobación'
)
WHERE contenido LIKE 'Su reserva en la sala % ha sido pendiente'
AND contenido IS NOT NULL; 