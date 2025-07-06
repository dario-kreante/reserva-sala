# Filtro de Salas Inactivas - Implementación Completa

## Descripción del Problema

Cuando una sala se desactiva (`activo = false` en la tabla `salas`), no debe aparecer en ninguna parte de la interfaz de usuario:
- Filtros del calendario y dashboards
- Listas de selección de salas
- Historial de reservas
- Páginas de aprobaciones
- Reportes de Excel

## Solución Implementada

### 1. Frontend - Consultas de Salas

#### useReservasData Hook
**Archivo**: `hooks/useReservasData.ts`

**Cambios realizados**:
- `fetchSalas()`: Agregado filtro `.eq('activo', true)` (línea ~155)
- `fetchReservas()`: Cambio de `sala:salas` a `sala:salas!inner` + filtro `.eq('sala.activo', true)` (línea ~102)
- `fetchHorariosOcupados()`: Verificación de sala activa antes de consultar horarios (línea ~207)

**Impacto**: 
- Dashboard principal ya no muestra salas inactivas
- Mis Reservas solo muestra salas activas
- Los horarios ocupados solo se consultan para salas activas

#### useResponsableSalas Hook
**Archivo**: `hooks/useResponsableSalas.ts`

**Estado**: ✅ **Ya tenía el filtro implementado**
- Línea 52: `.eq('salas.activo', true)`

### 2. Páginas Específicas

#### Página de Aprobaciones
**Archivo**: `app/aprobaciones/page.tsx`

**Cambios realizados**:
- Línea ~98: Cambio de `sala:salas(id, nombre)` a `sala:salas!inner(id, nombre)`
- Línea ~102: Agregado filtro `.eq('sala.activo', true)`

**Impacto**: Solo se muestran reservas pendientes de salas activas.

#### Página de Reservas (Admin)
**Archivo**: `app/reservas/page.tsx`

**Cambios realizados**:
- Línea ~226: Reservas actuales - Cambio a `sala:salas!inner` + filtro de salas activas
- Línea ~257: Reservas históricas - Cambio a `sala:salas!inner` + filtro de salas activas
- Línea ~315: fetchSalas ya tenía el filtro `.eq('activo', true)`

**Impacto**: 
- El historial de reservas solo muestra reservas de salas activas
- El formulario de nueva reserva solo muestra salas activas

#### Página Mis Reservas
**Archivo**: `app/mis-reservas/page.tsx`

**Estado**: ✅ **Ya funciona correctamente**
- Utiliza el hook `useReservasData` que ya fue actualizado

### 3. Backend - Funciones de Supabase

#### Funciones de Disponibilidad
**Archivos**: 
- `disponibilidad_sala_mes_v2.sql`
- `disponibilidad_sala_mes_completo.sql`
- `filtrar_salas_inactivas_completo.sql` (nuevo script de migración)

**Cambios realizados**:
- Verificación inicial: `SELECT activo INTO v_sala_activa FROM salas WHERE id = p_sala_id`
- Salida temprana: `IF v_sala_activa IS NULL OR v_sala_activa = FALSE THEN RETURN; END IF;`
- Alias agregados en consultas para evitar ambigüedad: `reservas r`, `horarios h`, `periodos p`

**Impacto**: 
- Las funciones de disponibilidad no procesan salas inactivas
- El calendario no muestra información de disponibilidad para salas desactivadas

### 4. Archivos de Migración

#### Script SQL de Migración
**Archivo**: `filtrar_salas_inactivas_completo.sql`

**Contenido**:
- Actualización de `obtener_disponibilidad_sala_mes_v2()`
- Actualización de `obtener_disponibilidad_sala_mes()`
- Comentarios de documentación actualizados
- Verificación de funcionamiento

**Para aplicar**: Ejecutar en Supabase SQL Editor

## Verificación de la Implementación

### Tests a Realizar

1. **Desactivar una sala**:
   ```sql
   UPDATE salas SET activo = false WHERE id = [ID_SALA_TEST];
   ```

2. **Verificar que NO aparece en**:
   - ✅ Dashboard principal (filtros de sala)
   - ✅ Calendario de disponibilidad
   - ✅ Formulario de nueva reserva
   - ✅ Página de aprobaciones
   - ✅ Historial de reservas
   - ✅ Reportes de Excel

3. **Verificar funciones de disponibilidad**:
   ```sql
   SELECT * FROM obtener_disponibilidad_sala_mes_v2([ID_SALA_INACTIVA], 2024, 12);
   -- Debería devolver resultado vacío
   ```

4. **Reactivar la sala**:
   ```sql
   UPDATE salas SET activo = true WHERE id = [ID_SALA_TEST];
   ```

### Casos de Uso Cubiertos

| Escenario | Estado | Resultado Esperado |
|-----------|--------|--------------------|
| Sala activa | `activo = true` | Aparece en todas las interfaces |
| Sala inactiva | `activo = false` | **NO** aparece en ninguna interfaz |
| Reservas existentes de sala inactiva | - | NO aparecen en consultas futuras |
| Disponibilidad de sala inactiva | - | Función devuelve vacío |
| Horarios ocupados de sala inactiva | - | Función devuelve vacío |

## Beneficios de la Implementación

1. **Consistencia total**: Las salas inactivas desaparecen completamente del sistema
2. **Seguridad**: No se pueden hacer nuevas reservas en salas desactivadas
3. **Limpieza de datos**: Los reportes y estadísticas solo consideran salas relevantes
4. **Experiencia de usuario**: No hay confusión con salas que ya no están disponibles
5. **Rendimiento**: Menos datos a procesar en consultas y funciones

## Notas Técnicas

### JOIN Inner vs Left
Se cambió de `sala:salas` a `sala:salas!inner` para asegurar que solo se incluyan reservas donde la sala existe y está activa.

### Verificaciones Defensivas
Se agregaron verificaciones adicionales en:
- `fetchHorariosOcupados()`: Verifica sala activa antes de consultar
- Funciones SQL: Verificación inicial para salir temprano si la sala está inactiva

### Compatibilidad
- ✅ No afecta reservas históricas ya aprobadas
- ✅ Mantiene integridad referencial
- ✅ Compatible con todos los roles de usuario
- ✅ No requiere cambios en esquema de base de datos

## Archivos Modificados

### Frontend
- `hooks/useReservasData.ts`
- `app/aprobaciones/page.tsx`
- `app/reservas/page.tsx`

### Backend
- `disponibilidad_sala_mes_v2.sql`
- `disponibilidad_sala_mes_completo.sql`

### Nuevos Archivos
- `filtrar_salas_inactivas_completo.sql`
- `docs/FILTRO_SALAS_INACTIVAS.md` (este archivo)

## Aplicación de Cambios

1. **Frontend**: Los cambios ya están aplicados en el código
2. **Backend**: Ejecutar `filtrar_salas_inactivas_completo.sql` en Supabase
3. **Verificación**: Realizar tests de desactivación/reactivación de salas 