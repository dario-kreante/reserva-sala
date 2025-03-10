-- Script para verificar la existencia de las funciones de disponibilidad

-- Verificar obtener_disponibilidad_sala_mes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'obtener_disponibilidad_sala_mes'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'La función obtener_disponibilidad_sala_mes existe.';
  ELSE
    RAISE NOTICE 'La función obtener_disponibilidad_sala_mes NO existe.';
  END IF;
END
$$;

-- Verificar obtener_disponibilidad_sala_mes_v2
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'obtener_disponibilidad_sala_mes_v2'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'La función obtener_disponibilidad_sala_mes_v2 existe.';
  ELSE
    RAISE NOTICE 'La función obtener_disponibilidad_sala_mes_v2 NO existe.';
  END IF;
END
$$;

-- Verificar obtener_disponibilidad_sala_mes_json
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'obtener_disponibilidad_sala_mes_json'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'La función obtener_disponibilidad_sala_mes_json existe.';
  ELSE
    RAISE NOTICE 'La función obtener_disponibilidad_sala_mes_json NO existe.';
  END IF;
END
$$; 