-- Script para implementar sistema de notificaciones por lotes para reservas concurrentes
-- Solución para prevenir múltiples mensajes a Make desde Supabase

-- 1. Crear tabla para agrupar notificaciones por lotes
CREATE TABLE IF NOT EXISTS lotes_notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id TEXT UNIQUE NOT NULL, -- Identificador único del lote
  usuario_id UUID REFERENCES auth.users(id),
  tipo_operacion TEXT NOT NULL, -- 'crear_reservas', 'aprobar_reservas', etc.
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'procesado', 'enviado'
  contexto JSONB, -- Información adicional del contexto
  reservas_ids UUID[] DEFAULT '{}', -- Array de IDs de reservas relacionadas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- 2. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_lotes_notificaciones_estado_expires 
ON lotes_notificaciones(estado, expires_at);

CREATE INDEX IF NOT EXISTS idx_lotes_notificaciones_lote_id 
ON lotes_notificaciones(lote_id);

-- 3. Función para limpiar lotes expirados
CREATE OR REPLACE FUNCTION limpiar_lotes_expirados()
RETURNS INTEGER AS $$
DECLARE
  v_eliminados INTEGER;
BEGIN
  DELETE FROM lotes_notificaciones 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_eliminados = ROW_COUNT;
  RETURN v_eliminados;
END;
$$ LANGUAGE plpgsql;

-- 4. Función mejorada para crear notificaciones por lotes
CREATE OR REPLACE FUNCTION crear_notificacion_reserva_batch()
RETURNS TRIGGER AS $$
DECLARE
  v_sala_nombre TEXT;
  v_fecha_formateada TEXT;
  v_hora_inicio TEXT;
  v_hora_fin TEXT;
  v_contenido TEXT;
  v_tipo TEXT;
  v_lote_id TEXT;
  v_lote_existente BOOLEAN;
  v_motivo_rechazo TEXT;
  v_contexto JSONB;
BEGIN
  -- Obtener información de la sala
  SELECT nombre INTO v_sala_nombre
  FROM salas
  WHERE id = NEW.sala_id;
  
  -- Formatear fecha y hora
  v_fecha_formateada := TO_CHAR(NEW.fecha, 'DD/MM/YYYY');
  v_hora_inicio := TO_CHAR(NEW.hora_inicio::time, 'HH24:MI');
  v_hora_fin := TO_CHAR(NEW.hora_fin::time, 'HH24:MI');
  
  -- Generar lote_id basado en el contexto de la operación
  IF TG_OP = 'INSERT' THEN
    -- Para nuevas reservas, agrupar por usuario, fecha y sala en un período de 30 segundos
    v_lote_id := 'reserva_nueva_' || NEW.usuario_id::TEXT || '_' || 
                 NEW.fecha::TEXT || '_' || NEW.sala_id::TEXT || '_' ||
                 EXTRACT(EPOCH FROM DATE_TRUNC('minute', NOW()))::TEXT;
    
    v_tipo := 'reserva_batch';
    v_contexto := jsonb_build_object(
      'tipo_operacion', 'crear_reservas',
      'sala_nombre', v_sala_nombre,
      'fecha', v_fecha_formateada,
      'estado_reserva', NEW.estado
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para actualizaciones, agrupar por tipo de cambio de estado
    IF NEW.estado = 'aprobada' AND OLD.estado != 'aprobada' THEN
      v_lote_id := 'reserva_aprobada_' || NEW.usuario_id::TEXT || '_' ||
                   EXTRACT(EPOCH FROM DATE_TRUNC('minute', NOW()))::TEXT;
      v_tipo := 'reserva_batch';
      v_contexto := jsonb_build_object(
        'tipo_operacion', 'aprobar_reservas',
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado
      );
      
    ELSIF NEW.estado = 'rechazada' AND OLD.estado != 'rechazada' THEN
      v_lote_id := 'reserva_rechazada_' || NEW.usuario_id::TEXT || '_' ||
                   EXTRACT(EPOCH FROM DATE_TRUNC('minute', NOW()))::TEXT;
      v_tipo := 'alerta_batch';
      
      -- Preparar motivo de rechazo
      v_motivo_rechazo := '';
      IF NEW.motivo_rechazo IS NOT NULL AND NEW.motivo_rechazo != '' THEN
        v_motivo_rechazo := NEW.motivo_rechazo;
      ELSIF NEW.comentarios IS NOT NULL AND NEW.comentarios != '' THEN
        v_motivo_rechazo := NEW.comentarios;
      END IF;
      
      v_contexto := jsonb_build_object(
        'tipo_operacion', 'rechazar_reservas',
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado,
        'motivo_rechazo', v_motivo_rechazo
      );
      
    ELSIF NEW.estado = 'cancelada' AND OLD.estado != 'cancelada' THEN
      v_lote_id := 'reserva_cancelada_' || NEW.usuario_id::TEXT || '_' ||
                   EXTRACT(EPOCH FROM DATE_TRUNC('minute', NOW()))::TEXT;
      v_tipo := 'sistema_batch';
      v_contexto := jsonb_build_object(
        'tipo_operacion', 'cancelar_reservas',
        'estado_anterior', OLD.estado,
        'estado_nuevo', NEW.estado
      );
      
    ELSE
      -- No procesar otros cambios
      RETURN NEW;
    END IF;
  END IF;
  
  -- Verificar si ya existe un lote para esta operación
  SELECT EXISTS (
    SELECT 1 
    FROM lotes_notificaciones 
    WHERE lote_id = v_lote_id 
      AND estado = 'pendiente'
      AND expires_at > NOW()
  ) INTO v_lote_existente;
  
  -- Si el lote no existe, crearlo
  IF NOT v_lote_existente THEN
    INSERT INTO lotes_notificaciones (
      lote_id, 
      usuario_id, 
      tipo_operacion, 
      contexto, 
      reservas_ids
    ) VALUES (
      v_lote_id,
      NEW.usuario_id,
      (v_contexto->>'tipo_operacion'),
      v_contexto,
      ARRAY[NEW.id]
    );
  ELSE
    -- Si el lote existe, agregar esta reserva al array
    UPDATE lotes_notificaciones 
    SET reservas_ids = array_append(reservas_ids, NEW.id),
        contexto = contexto || jsonb_build_object('total_reservas', array_length(reservas_ids, 1) + 1)
    WHERE lote_id = v_lote_id 
      AND estado = 'pendiente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Función para procesar lotes y crear notificaciones consolidadas
CREATE OR REPLACE FUNCTION procesar_lotes_notificaciones()
RETURNS INTEGER AS $$
DECLARE
  v_lote RECORD;
  v_contenido TEXT;
  v_tipo TEXT;
  v_total_procesados INTEGER := 0;
  v_total_reservas INTEGER;
  v_primer_sala TEXT;
  v_primer_fecha TEXT;
BEGIN
  -- Procesar lotes pendientes que han expirado o tienen más de 3 reservas
  FOR v_lote IN 
    SELECT * FROM lotes_notificaciones 
    WHERE estado = 'pendiente' 
      AND (expires_at <= NOW() OR array_length(reservas_ids, 1) >= 3)
    ORDER BY created_at ASC
  LOOP
    v_total_reservas := array_length(v_lote.reservas_ids, 1);
    
    -- Generar contenido consolidado basado en el tipo de operación
    CASE v_lote.tipo_operacion
      WHEN 'crear_reservas' THEN
        v_tipo := 'reserva';
        IF v_total_reservas = 1 THEN
          v_contenido := 'Su reserva en la sala ' || (v_lote.contexto->>'sala_nombre') || 
                        ' para el día ' || (v_lote.contexto->>'fecha') ||
                        ' ha sido registrada y está pendiente de aprobación.';
        ELSE
          v_contenido := 'Se han registrado ' || v_total_reservas || ' reservas' ||
                        ' que están pendientes de aprobación. Revise la sección "Mis Reservas" para más detalles.';
        END IF;
        
      WHEN 'aprobar_reservas' THEN
        v_tipo := 'reserva';
        IF v_total_reservas = 1 THEN
          v_contenido := '¡Su reserva ha sido aprobada! Revise la sección "Mis Reservas" para más detalles.';
        ELSE
          v_contenido := '¡' || v_total_reservas || ' de sus reservas han sido aprobadas! ' ||
                        'Revise la sección "Mis Reservas" para más detalles.';
        END IF;
        
      WHEN 'rechazar_reservas' THEN
        v_tipo := 'alerta';
        IF v_total_reservas = 1 THEN
          v_contenido := 'Su reserva ha sido rechazada.';
          IF v_lote.contexto->>'motivo_rechazo' IS NOT NULL AND v_lote.contexto->>'motivo_rechazo' != '' THEN
            v_contenido := v_contenido || ' Motivo: ' || (v_lote.contexto->>'motivo_rechazo');
          END IF;
        ELSE
          v_contenido := v_total_reservas || ' de sus reservas han sido rechazadas. ' ||
                        'Revise la sección "Mis Reservas" para más detalles.';
        END IF;
        
      WHEN 'cancelar_reservas' THEN
        v_tipo := 'sistema';
        IF v_total_reservas = 1 THEN
          v_contenido := 'Su reserva ha sido cancelada.';
        ELSE
          v_contenido := v_total_reservas || ' de sus reservas han sido canceladas.';
        END IF;
        
      ELSE
        v_tipo := 'sistema';
        v_contenido := 'Actualización en sus reservas. Revise la sección "Mis Reservas".';
    END CASE;
    
    -- Crear la notificación consolidada
    INSERT INTO notificaciones (usuario_id, tipo, contenido, metadata)
    VALUES (
      v_lote.usuario_id, 
      v_tipo, 
      v_contenido,
      jsonb_build_object(
        'lote_id', v_lote.lote_id,
        'total_reservas', v_total_reservas,
        'reservas_ids', v_lote.reservas_ids,
        'tipo_operacion', v_lote.tipo_operacion
      )
    );
    
    -- Marcar el lote como procesado
    UPDATE lotes_notificaciones 
    SET estado = 'procesado', processed_at = NOW()
    WHERE id = v_lote.id;
    
    v_total_procesados := v_total_procesados + 1;
  END LOOP;
  
  -- Limpiar lotes antiguos
  PERFORM limpiar_lotes_expirados();
  
  RETURN v_total_procesados;
END;
$$ LANGUAGE plpgsql;

-- 6. Reemplazar triggers existentes con el nuevo sistema
DROP TRIGGER IF EXISTS crear_notificacion_nueva_reserva ON reservas;
DROP TRIGGER IF EXISTS crear_notificacion_actualizacion_reserva ON reservas;

-- Crear nuevos triggers que usan el sistema de lotes
CREATE TRIGGER crear_notificacion_reserva_batch_insert
AFTER INSERT ON reservas
FOR EACH ROW
EXECUTE FUNCTION crear_notificacion_reserva_batch();

CREATE TRIGGER crear_notificacion_reserva_batch_update
AFTER UPDATE OF estado ON reservas
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION crear_notificacion_reserva_batch();

-- 7. Crear función para ejecutar procesamiento automático
CREATE OR REPLACE FUNCTION ejecutar_procesamiento_lotes_automatico()
RETURNS VOID AS $$
BEGIN
  -- Procesar lotes cada vez que se llame esta función
  PERFORM procesar_lotes_notificaciones();
END;
$$ LANGUAGE plpgsql;

-- 8. Crear job programado (requiere extensión pg_cron si está disponible)
-- Para ejecutar cada 30 segundos y procesar lotes pendientes
-- SELECT cron.schedule('procesar-lotes-notificaciones', '*/30 * * * * *', 'SELECT ejecutar_procesamiento_lotes_automatico();');

-- 9. Agregar columna metadata a notificaciones si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notificaciones' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notificaciones ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- 10. Crear función para webhook que solo se ejecuta con notificaciones consolidadas
CREATE OR REPLACE FUNCTION enviar_webhook_notificacion_consolidada()
RETURNS TRIGGER AS $$
DECLARE
  v_webhook_url TEXT;
  v_payload JSONB;
  v_request_id_net BIGINT;
BEGIN
  -- Solo procesar notificaciones que vienen del sistema de lotes
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'lote_id' THEN
    
    -- Obtener la URL del webhook desde los secretos de Supabase
    SELECT decrypted_secret INTO v_webhook_url 
    FROM vault.decrypted_secrets 
    WHERE name = 'MAKE_WEBHOOK_URL';

    IF v_webhook_url IS NULL THEN
      RAISE LOG 'Error: El secreto MAKE_WEBHOOK_URL no está configurado en Supabase Vault.';
      RETURN NEW;
    END IF;

    -- Construir payload para Make
    v_payload := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.usuario_id,
      'type', NEW.tipo,
      'content', NEW.contenido,
      'batch_info', NEW.metadata,
      'created_at', NEW.created_at
    );
    
    -- Realizar la llamada HTTP al webhook de Make usando pg_net
    SELECT net.http_post(
      url := v_webhook_url,
      body := v_payload
    ) INTO v_request_id_net;
    
    RAISE LOG 'Webhook enviado a Make.com para lote %. Request ID: %', 
      NEW.metadata->>'lote_id', v_request_id_net;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Crear trigger para webhook consolidado
DROP TRIGGER IF EXISTS webhook_notificacion_trigger ON notificaciones;
CREATE TRIGGER webhook_notificacion_consolidada_trigger
AFTER INSERT ON notificaciones
FOR EACH ROW
EXECUTE FUNCTION enviar_webhook_notificacion_consolidada();

-- 12. Función de utilidad para forzar procesamiento de lotes pendientes
CREATE OR REPLACE FUNCTION forzar_procesamiento_lotes()
RETURNS TEXT AS $$
DECLARE
  v_procesados INTEGER;
BEGIN
  SELECT procesar_lotes_notificaciones() INTO v_procesados;
  RETURN 'Procesados ' || v_procesados || ' lotes de notificaciones.';
END;
$$ LANGUAGE plpgsql;

-- Comentarios sobre el uso:
-- 
-- PARA USAR EN PRODUCCIÓN:
-- 1. Ejecutar este script en Supabase
-- 2. Configurar un cron job o función edge para llamar procesar_lotes_notificaciones() cada 30-60 segundos
-- 3. Configurar el webhook de Make para recibir solo las notificaciones consolidadas
-- 4. Para forzar procesamiento inmediato, ejecutar: SELECT forzar_procesamiento_lotes();
--
-- VENTAJAS:
-- - Agrupa reservas creadas en lotes (ej: horarios recurrentes) en una sola notificación
-- - Reduce significativamente las llamadas a Make
-- - Mantiene la funcionalidad existente para reservas individuales
-- - Proporciona mejor experiencia de usuario con mensajes más claros 