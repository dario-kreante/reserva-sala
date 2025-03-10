# Solución al problema de ambigüedad en la columna "fecha"

## Problema

El componente `DisponibilidadCalendario` está mostrando el error:

```
Error de Supabase: {
  code: '42702',
  details: 'It could refer to either a PL/pgSQL variable or a table column.',
  hint: null,
  message: 'column reference "fecha" is ambiguous'
}
```

Este error ocurre porque hay una ambigüedad en la referencia a la columna "fecha" en las funciones SQL. Esto significa que hay múltiples tablas o variables con una columna llamada "fecha" y no se especifica a cuál se refiere.

## Solución

Hemos creado varias soluciones para resolver este problema:

1. **Solución 1: Corregir la función existente**
   - Archivo: `corregir_ambiguedad_fecha.sql`
   - Esta solución corrige la función `obtener_disponibilidad_sala_mes_json` para que utilice alias de tabla y referencie explícitamente la columna con ese alias.

2. **Solución 2: Crear una función alternativa**
   - Archivo: `solucion_alternativa.sql`
   - Esta solución crea una nueva función `obtener_disponibilidad_sala_mes_json_v2` que no depende de otras funciones y es completamente independiente.

3. **Solución 3: Modificar el componente React**
   - Archivo: `components/ui/disponibilidad-calendario.tsx`
   - Esta solución modifica el componente para que intente utilizar la nueva función `obtener_disponibilidad_sala_mes_json_v2` primero, y si falla, intente con la función original.

4. **Solución completa**
   - Archivo: `solucion_completa.sql`
   - Este archivo contiene todas las funciones necesarias para el componente de disponibilidad, incluyendo las versiones corregidas.

## Instrucciones para aplicar la solución

1. **Ejecutar el script SQL**
   - Abre el editor SQL de Supabase
   - Copia y pega el contenido del archivo `solucion_completa.sql`
   - Ejecuta el script

2. **Verificar que las funciones se han creado correctamente**
   - Puedes verificar que las funciones se han creado correctamente en la sección "Database Functions" de Supabase
   - Deberías ver las siguientes funciones:
     - `obtener_disponibilidad_sala_mes`
     - `obtener_disponibilidad_sala_mes_v2`
     - `obtener_disponibilidad_sala_mes_json`
     - `obtener_disponibilidad_sala_mes_json_v2`

3. **Probar el componente**
   - Vuelve a la aplicación y prueba el componente `DisponibilidadCalendario`
   - Ahora debería funcionar correctamente y mostrar la disponibilidad de la sala

## Explicación técnica

El problema de ambigüedad en la columna "fecha" ocurre porque la función `obtener_disponibilidad_sala_mes_json` utiliza la función `obtener_disponibilidad_sala_mes_v2` para obtener la disponibilidad, pero no especifica a qué tabla pertenece la columna "fecha" cuando la referencia.

La solución es agregar un alias a la tabla en la consulta y referenciar explícitamente la columna con ese alias:

```sql
-- Antes (con ambigüedad)
FOR v_disponibilidad IN 
  SELECT * FROM public.obtener_disponibilidad_sala_mes_v2(p_sala_id, p_anio, p_mes)
LOOP
  -- ...
END LOOP;

-- Después (sin ambigüedad)
FOR v_disponibilidad IN 
  SELECT d.fecha, d.disponible, d.bloques_disponibles, d.bloques_totales 
  FROM public.obtener_disponibilidad_sala_mes_v2(p_sala_id, p_anio, p_mes) d
LOOP
  -- ...
END LOOP;
```

La solución alternativa es crear una nueva función que no dependa de otras funciones y que calcule la disponibilidad directamente, evitando así cualquier ambigüedad.

## Depuración

Si sigues teniendo problemas, puedes utilizar la página de depuración que hemos creado:

1. Accede a la página de depuración en `/debug`
2. Ingresa el ID de la sala, el año y el mes
3. Haz clic en "Probar Funciones"
4. Verás los resultados de las funciones y cualquier error que pueda ocurrir

Esta página te ayudará a diagnosticar problemas con las funciones de disponibilidad. 