# Mejora de las notificaciones de reservas (Versión final)

## Problemas identificados

1. **Texto confuso en las notificaciones**: El mensaje actual "Su reserva en la sala 46 ha sido pendiente" no es claro para los usuarios.

2. **Notificaciones con contenido NULL**: Hay notificaciones con valores NULL en la columna "contenido", lo que viola la restricción NOT NULL de la tabla.

3. **Notificaciones duplicadas**: Se están generando notificaciones duplicadas para una misma reserva, probablemente debido a la interacción entre nuestro nuevo trigger y algún trigger existente.

4. **Falta de información en notificaciones de rechazo**: Las notificaciones de rechazo no incluyen el motivo por el cual la reserva fue rechazada.

## Solución completa

Hemos creado un script SQL mejorado que:

1. Soluciona el problema de las notificaciones con contenido NULL
2. Mejora el texto de las notificaciones de reservas
3. Previene la creación de notificaciones duplicadas
4. Limpia las notificaciones duplicadas existentes
5. Incluye el motivo de rechazo en las notificaciones de reservas rechazadas

### Mejoras en el texto de las notificaciones:

1. **Formato de fecha más legible**: Cambio del formato YYYY-MM-DD a DD/MM/YYYY.
2. **Inclusión de horarios**: Adición de la hora de inicio y fin de la reserva.
3. **Mensajes más claros**: Redacción mejorada que explica claramente el estado de la reserva.
4. **Consistencia**: Formato consistente para todos los tipos de notificaciones de reservas.
5. **Motivo de rechazo**: Inclusión del comentario de rechazo cuando una reserva es rechazada.

### Prevención de duplicados:

1. **Verificación de existencia**: Antes de crear una nueva notificación, se verifica si ya existe una similar para el mismo usuario y sala en los últimos 5 minutos.
2. **Limpieza de duplicados existentes**: Se eliminan las notificaciones duplicadas existentes, manteniendo solo la más reciente.
3. **Desactivación de triggers conflictivos**: Se busca y desactiva cualquier trigger existente que pueda estar causando duplicados.

## Ejemplos de mensajes mejorados:

**Reserva pendiente (antes):**
```
Su reserva en la sala 46 ha sido pendiente
```

**Reserva pendiente (después):**
```
Su reserva en la sala A101 para el día 10/03/2023 de 14:00 a 16:00 ha sido registrada y está pendiente de aprobación.
```

**Reserva aprobada:**
```
¡Su reserva ha sido aprobada! Sala A101 para el día 10/03/2023 de 14:00 a 16:00.
```

**Reserva rechazada (sin motivo):**
```
Su reserva en la sala A101 para el día 10/03/2023 de 14:00 a 16:00 ha sido rechazada.
```

**Reserva rechazada (con motivo):**
```
Su reserva en la sala A101 para el día 10/03/2023 de 14:00 a 16:00 ha sido rechazada. Motivo: La sala está reservada para un evento institucional.
```

## Implementación

El script `prevenir_notificaciones_duplicadas.sql` realiza las siguientes acciones:

1. **Corrige las notificaciones con contenido NULL**: Actualiza las notificaciones existentes que tienen contenido NULL.

2. **Elimina notificaciones duplicadas**: Identifica y elimina notificaciones duplicadas existentes, manteniendo solo la más reciente.

3. **Crea una función mejorada**: Implementa `crear_notificacion_reserva()` con verificación de duplicados y manejo de motivos de rechazo.

4. **Desactiva triggers conflictivos**: Busca y desactiva cualquier trigger existente que pueda estar causando duplicados.

5. **Crea nuevos triggers**: Establece triggers para insertar y actualizar reservas que utilizan la función mejorada.

6. **Actualiza las notificaciones existentes**: Mejora el formato de las notificaciones existentes, incluyendo los motivos de rechazo cuando están disponibles.

## Instrucciones para aplicar la solución

1. **Ejecutar el script SQL mejorado**
   - Abre el editor SQL de Supabase
   - Copia y pega el contenido del archivo `prevenir_notificaciones_duplicadas.sql`
   - Ejecuta el script

2. **Verificar la corrección**
   - Comprueba que no hay errores durante la ejecución del script
   - Crea una nueva reserva para verificar que:
     - La notificación se genera con el nuevo formato
     - No se crean notificaciones duplicadas
   - Rechaza una reserva con un comentario y verifica que el motivo aparece en la notificación
   - Comprueba que las notificaciones existentes se han actualizado correctamente

## Consideraciones adicionales

- Este script mejorado maneja adecuadamente las notificaciones con contenido NULL, evitando el error 23502.
- La verificación de duplicados se basa en la similitud del contenido y la proximidad temporal (5 minutos), lo que debería cubrir la mayoría de los casos de duplicación.
- La solución es compatible con el sistema de notificaciones existente y no requiere cambios en el frontend.
- Los usuarios verán inmediatamente las notificaciones mejoradas en la interfaz de usuario, sin duplicados.
- Los motivos de rechazo se incluyen automáticamente en las notificaciones cuando están disponibles, mejorando la comunicación con los usuarios.

## Solución de problemas

Si encuentras algún error al ejecutar el script, verifica:

1. Que no haya notificaciones con formatos inesperados en la base de datos
2. Que los triggers existentes no entren en conflicto con los nuevos
3. Que la función `enviar_notificacion_webhook` mencionada en el trigger existente esté funcionando correctamente

Si siguen apareciendo notificaciones duplicadas, es posible que haya otro mecanismo en la aplicación que esté generando notificaciones. En ese caso, sería necesario revisar el código de la aplicación para identificar y corregir esa fuente adicional de notificaciones. 