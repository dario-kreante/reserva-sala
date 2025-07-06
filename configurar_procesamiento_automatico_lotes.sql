-- Script para configurar el procesamiento automático de lotes de notificaciones
-- Este script configura diferentes métodos para automatizar el procesamiento

-- ========================================
-- MÉTODO 1: USANDO PG_CRON (Si está disponible)
-- ========================================

-- Verificar si pg_cron está disponible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Si pg_cron está disponible, programar el job
    PERFORM cron.schedule(
      'procesar-lotes-notificaciones',
      '*/1 * * * *', -- Cada minuto
      'SELECT procesar_lotes_notificaciones();'
    );
    
    RAISE NOTICE 'Job de cron configurado para ejecutarse cada minuto';
  ELSE
    RAISE NOTICE 'pg_cron no está disponible. Use el método alternativo con Edge Functions.';
  END IF;
END $$;

-- ========================================
-- MÉTODO 2: FUNCIÓN PARA LLAMAR DESDE EDGE FUNCTION
-- ========================================

-- Esta función será llamada desde una Edge Function programada
CREATE OR REPLACE FUNCTION procesar_lotes_con_estadisticas()
RETURNS JSONB AS $$
DECLARE
  v_lotes_procesados INTEGER;
  v_lotes_expirados INTEGER;
  v_estadisticas JSONB;
BEGIN
  -- Procesar lotes pendientes
  SELECT procesar_lotes_notificaciones() INTO v_lotes_procesados;
  
  -- Limpiar lotes expirados
  SELECT limpiar_lotes_expirados() INTO v_lotes_expirados;
  
  -- Construir estadísticas
  v_estadisticas := jsonb_build_object(
    'lotes_procesados', v_lotes_procesados,
    'lotes_expirados', v_lotes_expirados,
    'timestamp', NOW(),
    'success', true
  );
  
  RETURN v_estadisticas;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MÉTODO 3: TRIGGER PARA PROCESAMIENTO INMEDIATO
-- ========================================

-- Función que se ejecuta cuando se detectan muchas reservas concurrentes
CREATE OR REPLACE FUNCTION detectar_reservas_concurrentes()
RETURNS TRIGGER AS $$
DECLARE
  v_reservas_recientes INTEGER;
  v_umbral_concurrencia INTEGER := 5; -- Procesar cuando hay 5+ reservas en el último minuto
BEGIN
  -- Contar reservas creadas en el último minuto por el mismo usuario
  SELECT COUNT(*)
  INTO v_reservas_recientes
  FROM reservas
  WHERE usuario_id = NEW.usuario_id
    AND created_at > (NOW() - INTERVAL '1 minute');
  
  -- Si se detecta alta concurrencia, procesar lotes inmediatamente
  IF v_reservas_recientes >= v_umbral_concurrencia THEN
    PERFORM procesar_lotes_notificaciones();
    
    RAISE NOTICE 'Procesamiento inmediato activado: % reservas concurrentes detectadas', v_reservas_recientes;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para detección de concurrencia
DROP TRIGGER IF EXISTS detectar_concurrencia_trigger ON reservas;
CREATE TRIGGER detectar_concurrencia_trigger
AFTER INSERT ON reservas
FOR EACH ROW
EXECUTE FUNCTION detectar_reservas_concurrentes();

-- ========================================
-- FUNCIONES DE MONITOREO Y DIAGNÓSTICO
-- ========================================

-- Función para obtener estadísticas de lotes
CREATE OR REPLACE FUNCTION obtener_estadisticas_lotes()
RETURNS JSONB AS $$
DECLARE
  v_estadisticas JSONB;
  v_lotes_pendientes INTEGER;
  v_lotes_procesados_hoy INTEGER;
  v_reservas_en_lotes INTEGER;
BEGIN
  -- Contar lotes pendientes
  SELECT COUNT(*) INTO v_lotes_pendientes
  FROM lotes_notificaciones
  WHERE estado = 'pendiente';
  
  -- Contar lotes procesados hoy
  SELECT COUNT(*) INTO v_lotes_procesados_hoy
  FROM lotes_notificaciones
  WHERE estado = 'procesado' 
    AND DATE(processed_at) = CURRENT_DATE;
  
  -- Contar reservas actualmente en lotes pendientes
  SELECT COALESCE(SUM(array_length(reservas_ids, 1)), 0) INTO v_reservas_en_lotes
  FROM lotes_notificaciones
  WHERE estado = 'pendiente';
  
  v_estadisticas := jsonb_build_object(
    'lotes_pendientes', v_lotes_pendientes,
    'lotes_procesados_hoy', v_lotes_procesados_hoy,
    'reservas_en_lotes_pendientes', v_reservas_en_lotes,
    'timestamp', NOW()
  );
  
  RETURN v_estadisticas;
END;
$$ LANGUAGE plpgsql;

-- Función para diagnosticar problemas
CREATE OR REPLACE FUNCTION diagnosticar_sistema_lotes()
RETURNS TABLE (
  problema TEXT,
  descripcion TEXT,
  solucion TEXT
) AS $$
BEGIN
  -- Verificar lotes expirados no procesados
  IF EXISTS (
    SELECT 1 FROM lotes_notificaciones 
    WHERE estado = 'pendiente' AND expires_at < NOW() - INTERVAL '10 minutes'
  ) THEN
    RETURN QUERY SELECT 
      'Lotes expirados no procesados'::TEXT,
      'Hay lotes que expiraron hace más de 10 minutos sin procesar'::TEXT,
      'Ejecutar: SELECT forzar_procesamiento_lotes();'::TEXT;
  END IF;
  
  -- Verificar acumulación excesiva de lotes
  IF (SELECT COUNT(*) FROM lotes_notificaciones WHERE estado = 'pendiente') > 50 THEN
    RETURN QUERY SELECT 
      'Acumulación excesiva de lotes'::TEXT,
      'Hay más de 50 lotes pendientes de procesar'::TEXT,
      'Verificar que el job automático esté funcionando correctamente'::TEXT;
  END IF;
  
  -- Verificar funcionamiento del sistema de lotes
  IF NOT EXISTS (
    SELECT 1 FROM lotes_notificaciones 
    WHERE created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN QUERY SELECT 
      'No hay actividad reciente en lotes'::TEXT,
      'No se han creado lotes en la última hora'::TEXT,
      'Verificar que los triggers estén funcionando correctamente'::TEXT;
  END IF;
  
  -- Si no hay problemas
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'Sistema funcionando correctamente'::TEXT,
      'No se detectaron problemas en el sistema de lotes'::TEXT,
      'Monitoreo rutinario recomendado'::TEXT;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CONFIGURACIÓN PARA MAKE WEBHOOK
-- ========================================

-- Función para configurar webhook de Make
CREATE OR REPLACE FUNCTION configurar_webhook_make(webhook_url TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Guardar URL del webhook en una tabla de configuración
  -- (Necesitarías crear esta tabla si no existe)
  /*
  INSERT INTO configuracion (clave, valor)
  VALUES ('make_webhook_url', webhook_url)
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;
  */
  
  -- Por ahora, solo devolver instrucciones
  RETURN 'Para configurar Make webhook:
1. Crear webhook en Make que escuche POST requests
2. El payload incluirá: notification_id, user_id, type, content, batch_info
3. Filtrar solo notificaciones que tengan batch_info (lote_id) para evitar duplicados
4. Configurar la URL en la función enviar_webhook_notificacion_consolidada()';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMANDOS DE ADMINISTRACIÓN
-- ========================================

-- Mostrar comandos útiles para administrar el sistema
SELECT 'COMANDOS ÚTILES PARA ADMINISTRACIÓN:' AS info;
SELECT '1. Forzar procesamiento: SELECT forzar_procesamiento_lotes();' AS comando;
SELECT '2. Ver estadísticas: SELECT obtener_estadisticas_lotes();' AS comando;
SELECT '3. Diagnosticar problemas: SELECT * FROM diagnosticar_sistema_lotes();' AS comando;
SELECT '4. Limpiar lotes expirados: SELECT limpiar_lotes_expirados();' AS comando;
SELECT '5. Ver lotes pendientes: SELECT * FROM lotes_notificaciones WHERE estado = ''pendiente'';' AS comando;

-- Mensaje final
SELECT 'Sistema de notificaciones por lotes configurado exitosamente!' AS mensaje;
SELECT 'Recuerda configurar el Edge Function para llamar procesar_lotes_con_estadisticas() cada minuto.' AS recomendacion; 