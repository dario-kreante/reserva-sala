# Corrección de la lógica de disponibilidad de salas

## Problema

Se ha detectado un error en la lógica de disponibilidad de salas. Actualmente, el sistema está marcando días como "no disponibles" cuando en realidad sí tienen bloques de tiempo disponibles.

Por ejemplo, para el lunes 10 de marzo, que tiene una reserva de 00:00 a 13:00 horas, el sistema lo marca como "no disponible", a pesar de que hay disponibilidad desde las 13:00 hasta las 19:00 horas.

## Regla de negocio

La regla de negocio establece que:
- El horario en que se pueden solicitar salas es desde las 08:00 hasta las 21:30 horas.
- El bloque mínimo de solicitud es de 30 minutos.
- Un día se considera disponible si hay al menos un bloque de 30 minutos disponible dentro del horario permitido.

## Solución

Hemos corregido la lógica de disponibilidad en las funciones SQL para que un día se considere disponible si hay al menos un bloque de 30 minutos disponible entre las 8:00 y las 19:00 horas.

### Archivos creados

1. **corregir_logica_disponibilidad.sql**: Contiene la corrección para la función `obtener_disponibilidad_sala_mes_json_v2`.
2. **corregir_logica_disponibilidad_completa.sql**: Contiene la corrección para todas las funciones relacionadas con la disponibilidad.
3. **probar_disponibilidad.sql**: Script para probar la lógica de disponibilidad con un caso específico.

## Instrucciones para aplicar la solución

1. **Ejecutar el script SQL**
   - Abre el editor SQL de Supabase
   - Copia y pega el contenido del archivo `corregir_logica_disponibilidad_completa.sql`
   - Ejecuta el script

2. **Verificar la corrección**
   - Puedes ejecutar el script `probar_disponibilidad.sql` para verificar que la lógica de disponibilidad funciona correctamente.
   - Este script crea una reserva de prueba para el 10 de marzo de 2025 de 00:00 a 13:00 horas y luego verifica la disponibilidad.
   - Deberías ver que el día 10 de marzo está marcado como disponible, con varios bloques disponibles entre las 13:00 y las 19:00 horas.

3. **Probar en la aplicación**
   - Vuelve a la aplicación y prueba el componente `DisponibilidadCalendario`
   - Verifica que los días con reservas parciales (que tienen bloques disponibles) se muestren como disponibles.

## Cambios realizados

La principal corrección fue en la lógica que determina si un día está disponible. Anteriormente, la función estaba verificando incorrectamente la disponibilidad. Ahora, la función verifica cada bloque de 30 minutos entre las 8:00 y las 19:00 horas, y si al menos uno de estos bloques está disponible, el día se marca como disponible.

```sql
-- Antes (incorrecto)
disponible := NOT EXISTS (
  SELECT 1
  FROM reservas r
  WHERE r.sala_id = p_sala_id
    AND r.fecha = v_dia
    AND r.estado IN ('pendiente', 'aprobada')
);

-- Después (correcto)
-- Iterar por cada bloque de 30 minutos entre 8:00 y 19:00
FOR v_hora_inicio IN 
  SELECT ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n))::TIME
  FROM generate_series(0, (11*60/v_intervalo_minutos)::INTEGER - 1) AS n
  WHERE ('08:00:00'::TIME + (INTERVAL '1 minute' * v_intervalo_minutos * n) + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME <= '19:00:00'::TIME
LOOP
  v_hora_fin := (v_hora_inicio + (INTERVAL '1 minute' * v_intervalo_minutos))::TIME;
  v_bloques_totales := v_bloques_totales + 1;
  
  -- Verificar si este bloque está disponible
  IF NOT EXISTS (
    SELECT 1
    FROM reservas r
    WHERE r.sala_id = p_sala_id
      AND r.fecha = v_dia
      AND r.estado IN ('pendiente', 'aprobada')
      AND (
        (r.hora_inicio <= v_hora_inicio AND r.hora_fin > v_hora_inicio) OR
        (r.hora_inicio < v_hora_fin AND r.hora_fin >= v_hora_fin) OR
        (r.hora_inicio >= v_hora_inicio AND r.hora_fin <= v_hora_fin)
      )
  ) THEN
    -- Si el bloque está disponible, incrementamos el contador
    v_bloques_disponibles := v_bloques_disponibles + 1;
  END IF;
END LOOP;

-- Un día está disponible si hay al menos un bloque de 30 minutos disponible
disponible := v_bloques_disponibles > 0;
```

Esta corrección asegura que un día se marque como disponible si hay al menos un bloque de 30 minutos disponible entre las 8:00 y las 19:00 horas, cumpliendo así con la regla de negocio establecida. 