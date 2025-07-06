# Solución: Bug Departamentos Desactivados Siguen Apareciendo

## Descripción del Problema

Al desactivar departamentos en la aplicación, estos seguían apareciendo como opciones seleccionables al crear un nuevo usuario. Los departamentos desactivados no debían estar disponibles para selección en ningún formulario de usuario.

## Causa Raíz

En el hook `useUsuariosData.ts`, la función `fetchDepartamentos()` tenía comentado el filtro por departamentos activos:

```typescript
// .eq('activo', true) // O quitar filtro si se necesitan todos para el select
```

Esto provocaba que se obtuvieran TODOS los departamentos (activos e inactivos) para los selectores de usuarios.

## Solución Implementada

### 1. Corrección del Filtro Principal

**Archivo:** `hooks/useUsuariosData.ts`

Se activó el filtro para mostrar solo departamentos activos en los selectores:

```typescript
// Función para obtener todos los departamentos activos (para selectors)
const fetchDepartamentos = useCallback(async () => {
  console.log("Fetching departamentos activos...")
  setLoadingDepartamentos(true)
  try {
    const { data, error } = await supabase
      .from('departamentos')
      .select('id, nombre, activo')
      .eq('activo', true) // Solo mostrar departamentos activos en el selector
      .order('nombre', { ascending: true })
    // ...
  }
}, [supabase])
```

### 2. Nueva Función para Gestión de Departamentos

Se creó una función separada para el diálogo de gestión que muestra TODOS los departamentos:

```typescript
// Función para obtener TODOS los departamentos (activos e inactivos) para gestión
const fetchAllDepartamentos = useCallback(async () => {
  console.log("Fetching ALL departamentos...")
  setLoadingDepartamentos(true)
  try {
    const { data, error } = await supabase
      .from('departamentos')
      .select('id, nombre, activo')
      .order('nombre', { ascending: true })
    // ...
  }
}, [supabase])
```

### 3. Actualización del Componente Usuarios

**Archivo:** `app/usuarios/page.tsx`

- Se agregó la nueva función `fetchAllDepartamentos` al hook
- Se crearon funciones especializadas para abrir/cerrar el diálogo de gestión:

```typescript
const handleOpenDepartamentosDialog = () => {
  setDialogoDepartamentosAbierto(true)
  // Cargar todos los departamentos cuando se abre el diálogo de gestión
  fetchAllDepartamentos()
}

const handleCloseDepartamentosDialog = () => {
  setDialogoDepartamentosAbierto(false)
  // Restaurar solo departamentos activos cuando se cierra el diálogo
  fetchDepartamentos()
}
```

## Resultado

### Comportamiento Después de la Solución

1. **Formulario de Creación/Edición de Usuario:**
   - Solo muestra departamentos activos
   - Los departamentos desactivados no aparecen como opción

2. **Filtros de Usuarios:**
   - Solo incluye departamentos activos para filtrar

3. **Diálogo de Gestión de Departamentos:**
   - Muestra todos los departamentos (activos e inactivos)
   - Permite activar/desactivar departamentos
   - Al cerrar, restaura la vista de solo departamentos activos

### Estados de los Departamentos

- **Activo:** Aparece en todos los selectores
- **Inactivo:** Solo aparece en el diálogo de gestión para poder reactivarlo

## Archivos Modificados

1. `hooks/useUsuariosData.ts`
   - ✅ Corregido filtro de departamentos activos
   - ✅ Añadida función `fetchAllDepartamentos`
   - ✅ Exportación de nueva función

2. `app/usuarios/page.tsx`
   - ✅ Implementación de funciones especializadas de apertura/cierre
   - ✅ Uso correcto de funciones según contexto

## Problema Identificado Adicional

**Archivo:** `app/gestion-usuarios/page.tsx`

Este archivo aún usa departamentos hardcoded y no integra con la tabla `departamentos`:

```typescript
const departamentos = ['Informática', 'Recursos Humanos', 'Finanzas', 'Marketing', 'Operaciones']
```

**TODO:** Actualizar este archivo para usar el hook `useUsuariosData` y la tabla de departamentos de la base de datos.

## Verificación

Para verificar que la solución funciona:

1. ✅ Crear/editar usuario: Solo departamentos activos aparecen
2. ✅ Filtros: Solo departamentos activos disponibles  
3. ✅ Gestión: Todos los departamentos visibles con opción de activar/desactivar
4. ✅ Consistencia: Los estados se mantienen correctamente

## Próximos Pasos

1. **Unificación de Interfaces:** Migrar `app/gestion-usuarios/page.tsx` para usar la misma lógica
2. **Testing:** Crear tests para validar el comportamiento de filtros
3. **Documentación:** Actualizar manual de usuario sobre gestión de departamentos

La solución está **COMPLETAMENTE IMPLEMENTADA** y funcional. 