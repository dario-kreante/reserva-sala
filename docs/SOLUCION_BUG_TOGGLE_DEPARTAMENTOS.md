# Solución: Bug Toggle Departamentos - UI no Persiste Estado

## Descripción del Problema

Al activar/desactivar departamentos en la interfaz de gestión, la UI mostraba el cambio temporalmente, pero al recargar la lista de departamentos, el estado volvía a aparecer como activo. El usuario percibía que el botón no funcionaba correctamente.

## Causa Raíz

El problema estaba en el flujo de datos entre la gestión de departamentos y los selectores:

### Flujo Problemático:
1. **Abrir diálogo de gestión:** `fetchAllDepartamentos()` → carga todos los departamentos
2. **Desactivar departamento:** `toggleDepartamentoActivo()` → actualiza DB y lista local 
3. **Cerrar diálogo:** `fetchDepartamentos()` → sobrescribe con solo activos ❌

### El Conflicto:
- **Estado único:** `departamentos` se usaba tanto para gestión como para selectores
- **Sobrescritura:** Al cerrar gestión, se perdían los cambios locales al sobrescribir con datos de API

## Solución Implementada

### 1. Estados Separados

**Archivo:** `hooks/useUsuariosData.ts`

```typescript
export function useUsuariosData() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]) // Solo activos (selectores)
  const [allDepartamentos, setAllDepartamentos] = useState<Departamento[]>([]) // Todos (gestión)
  // ...
}
```

### 2. Funciones Actualizadas

**fetchAllDepartamentos:** Ahora actualiza `allDepartamentos`
```typescript
const fetchAllDepartamentos = useCallback(async () => {
  // ...
  setAllDepartamentos(data || []) // Estado separado para gestión
}, [supabase])
```

**toggleDepartamentoActivo:** Actualiza ambos estados
```typescript
const toggleDepartamentoActivo = async (id: number, estadoActual: boolean) => {
  // ... actualizar DB ...
  
  // Actualizar ambos estados de departamentos
  const updateFunction = (prev: Departamento[]) =>
    prev.map(dep =>
      dep.id === id ? { ...dep, activo: !estadoActual } : dep
    )
  
  setDepartamentos(updateFunction) // Departamentos activos
  setAllDepartamentos(updateFunction) // Todos los departamentos
}
```

### 3. Componente Actualizado

**Archivo:** `app/usuarios/page.tsx`

```typescript
const { 
  departamentos, // Solo activos para selectores
  allDepartamentos, // Todos para gestión
  // ...
} = useUsuariosData()

// Diálogo usa allDepartamentos
<GestionDepartamentosDialog
  departamentos={allDepartamentos} // 🎯 Estado correcto
  // ...
/>
```

### 4. Flujo Corregido

1. **Abrir gestión:** `fetchAllDepartamentos()` → carga en `allDepartamentos`
2. **Toggle departamento:** Actualiza DB + ambos estados locales
3. **Cerrar gestión:** `fetchDepartamentos()` → actualiza solo `departamentos` (selectores)
4. **Resultado:** ✅ Los cambios persisten en ambas vistas

## Beneficios de la Solución

### ✅ **Consistencia de Datos**
- Los estados de gestión y selectores se mantienen independientes
- Los cambios en gestión no afectan la visualización de selectores hasta el cierre

### ✅ **UX Mejorada**
- Los usuarios ven inmediatamente los cambios en la UI de gestión
- Los selectores siempre muestran departamentos activos actualizados
- No hay confusión sobre si el botón funcionó o no

### ✅ **Mantenibilidad**
- Separación clara de responsabilidades entre estados
- Fácil de debuggear y entender el flujo de datos
- Código más predecible y testeable

## Verificación de Funcionamiento

Para verificar que la solución funciona:

### Test Manual:
1. ✅ **Abrir gestión** → Ver todos los departamentos
2. ✅ **Desactivar departamento** → UI muestra cambio inmediato  
3. ✅ **Cerrar gestión** → Cambio persiste (no revierte)
4. ✅ **Crear usuario** → Solo departamentos activos en selector
5. ✅ **Reabrir gestión** → Estado correcto mantenido

### Logs de Verificación:
```typescript
console.log("All departamentos fetched:", data) // Al abrir gestión
console.log(`Estado del departamento ${id} cambiado.`) // Al toggle
console.log("Departamentos activos fetched:", data) // Al cerrar gestión
```

## Próximos Pasos

1. **Testing Automatizado:** Crear tests unitarios para ambos estados
2. **Performance:** Evaluar si es necesario optimizar con useMemo
3. **Documentación:** Actualizar guía de usuario sobre gestión de departamentos

---

## Estado: ✅ COMPLETAMENTE SOLUCIONADO

La funcionalidad de activar/desactivar departamentos ahora funciona correctamente y los cambios persisten como se espera en la interfaz de usuario. 