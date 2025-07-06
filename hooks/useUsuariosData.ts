import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Definir interfaz para Departamento
export interface Departamento {
  id: number
  nombre: string
  activo: boolean
}

export interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  rut: string
  rol: string
  departamento_id: number | null // ID del departamento
  departamento?: Departamento | null // Departamento relacionado (objeto único o null)
  activo: boolean
  fecha_creacion: string
}

// Base type without the conflicting/omitted fields
type BaseUsuarioForm = Omit<Usuario, 'id' | 'fecha_creacion' | 'departamento' | 'departamento_id'>;

// Final type for the form state
export type FormUsuarioData = BaseUsuarioForm & {
  departamento_id?: string | null; // Usamos string para el Select
};

export function useUsuariosData() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]) // Estado para departamentos activos (selectores)
  const [allDepartamentos, setAllDepartamentos] = useState<Departamento[]>([]) // Estado para gestión (todos)
  const [loading, setLoading] = useState(true)
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(true) // Estado de carga para departamentos
  const [error, setError] = useState<string | null>(null)

  // Función para obtener todos los usuarios con sus departamentos vía RPC
  const fetchUsuarios = useCallback(async () => {
    console.log("Fetching usuarios via RPC...")
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_usuarios_con_departamentos')

      if (rpcError) {
        console.error("Error calling RPC function:", rpcError)
        throw rpcError
      }

      console.log("Data received from RPC:", data)

      // Simplificación del Mapeo:
      // La respuesta RPC ya parece coincidir con la interfaz Usuario,
      // incluyendo el objeto 'departamento' anidado.
      const usuariosTyped = data.map((user: any) => ({ 
        ...user,
        // Asegurarse que el departamento sea un objeto o null (RPC puede devolver {} o null)
        // Si la RPC siempre devuelve un objeto o null, esto podría incluso eliminarse
        // y solo usar `...user` si los tipos coinciden perfectamente.
        departamento: user.departamento && typeof user.departamento === 'object' && Object.keys(user.departamento).length > 0 
                       ? user.departamento 
                       : null
      }));

      // Eliminar el bucle forEach que borraba propiedades inexistentes
      // usuariosTyped.forEach((user: any) => { ... }); <-- Eliminado

      console.log("Processed usuarios:", usuariosTyped)
      // El casting a Usuario[] asume que la estructura RPC + mapeo coincide
      setUsuarios(usuariosTyped as Usuario[]); 
    } catch (err) {
      console.error('Error fetching usuarios via RPC:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al obtener usuarios'
      setError(errorMessage)
      // Puedes decidir si quieres limpiar el array de usuarios en caso de error
      // setUsuarios([]); 
    } finally {
      setLoading(false)
    }
  }, [supabase])

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

      if (error) throw error
      console.log("Departamentos activos fetched:", data)
      setDepartamentos(data || [])
    } catch (err) {
      console.error('Error fetching departamentos:', err)
      // Considerar mostrar un error específico para departamentos
    } finally {
      setLoadingDepartamentos(false)
    }
  }, [supabase])

  // Función para obtener TODOS los departamentos (activos e inactivos) para gestión
  const fetchAllDepartamentos = useCallback(async () => {
    console.log("Fetching ALL departamentos...")
    setLoadingDepartamentos(true)
    try {
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, nombre, activo')
        .order('nombre', { ascending: true })

      if (error) throw error
      console.log("All departamentos fetched:", data)
      setAllDepartamentos(data || []) // Usar estado separado para gestión
    } catch (err) {
      console.error('Error fetching all departamentos:', err)
    } finally {
      setLoadingDepartamentos(false)
    }
  }, [supabase])

  // Función para crear un nuevo usuario
  const crearUsuario = async (datosCrear: FormUsuarioData) => {
    try {
      // Convertir departamento_id de string a number o null
      const departamentoIdNumerico = datosCrear.departamento_id
        ? parseInt(datosCrear.departamento_id, 10)
        : null

      const usuarioParaInsertar = {
        ...datosCrear,
        departamento_id: departamentoIdNumerico
      }

      // Quitar la propiedad departamento_id si es null para evitar enviarla innecesariamente si la DB no la espera
      // Sin embargo, Supabase maneja bien los null, así que usualmente no es necesario
      // if (usuarioParaInsertar.departamento_id === null) {
      //   delete usuarioParaInsertar.departamento_id;
      // }

      console.log('Insertando usuario:', usuarioParaInsertar)

      const { data, error } = await supabase
        .from('usuarios')
        .insert([usuarioParaInsertar])
        .select('id')
        .single()

      if (error) throw error

      // Ya no necesitamos procesar 'data' aquí porque fetchUsuarios actualiza la lista
      // const usuarioCreado = { ...data } as Usuario 
      console.log('Usuario creado exitosamente, ID:', data?.id)

      // Volver a cargar todos los usuarios para reflejar el cambio
      await fetchUsuarios()
      
      // Devolver éxito (sin datos específicos, ya que la UI se actualiza con fetchUsuarios)
      return { data: null, error: null }
    } catch (err) {
      console.error('Error creando usuario:', err)
      return { data: null, error: err instanceof Error ? err.message : 'Error al crear usuario' }
    }
  }

  const actualizarUsuario = async (id: string, datosActualizar: Partial<FormUsuarioData>) => {
    try {
       // Convertir departamento_id de string a number o null si está presente
       const departamentoIdNumerico = datosActualizar.departamento_id
         ? parseInt(datosActualizar.departamento_id, 10)
         : (datosActualizar.hasOwnProperty('departamento_id') ? null : undefined) // number | null | undefined

       // Crear el objeto para actualizar, quitando departamento_id original (string)
       const { departamento_id: _ , ...restoDatos } = datosActualizar
       
       const datosParaActualizar: Partial<Omit<Usuario, 'departamento' | 'departamento_id'> & { departamento_id?: number | null }> = {
         ...restoDatos, // Datos base sin el departamento_id string
       }
       
       // Solo incluir departamento_id si se está actualizando (con el tipo numérico)
       if (departamentoIdNumerico !== undefined) {
          datosParaActualizar.departamento_id = departamentoIdNumerico
       }

      console.log(`Actualizando usuario ${id}:`, datosParaActualizar)

      const { error: updateError } = await supabase
        .from('usuarios')
        .update(datosParaActualizar)
        .eq('id', id)

      if (updateError) throw updateError

      console.log(`Usuario ${id} actualizado en DB. Refrescando datos...`)

      // Volver a cargar todos los usuarios para asegurar consistencia
      await fetchUsuarios()

      // Opcional: Podrías intentar obtener solo el usuario actualizado y reemplazarlo localmente
      // pero recargar todo es más simple y robusto con el RPC actual.

      // Ejemplo de cómo sería obtener solo el actualizado (requiere que RPC acepte filtros o usar select directo si RLS lo permite)
      /*
      const { data: usuarioActualizado, error: fetchError } = await supabase
        .rpc('get_usuarios_con_departamentos') // Asumiendo que se puede filtrar por ID
        // .eq('id', id) // Esto no funciona directamente en RPC, necesitaría un parámetro en la función SQL
        // .single()
      // O si RLS permite leer al usuario autenticado/servicio:
      // const { data: usuarioActualizado, error: fetchError } = await supabase
      //   .from('usuarios')
      //    .select(` ... `)
      //   .eq('id', id)
      //   .single()

      if (fetchError) throw fetchError
      const usuarioActualizadoTyped = { ...usuarioActualizado } as Usuario
      setUsuarios(prev => prev.map(user => user.id === id ? usuarioActualizadoTyped : user))
      return { data: usuarioActualizadoTyped, error: null }
      */
      return { data: null, error: null } // Indicar éxito, los datos se actualizarán con fetchUsuarios

    } catch (err) {
      console.error('Error actualizando usuario:', err)
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Error al actualizar usuario' 
      }
    }
  }

  const cambiarEstadoUsuario = async (id: string, activo: boolean) => {
    try {
      console.log(`Cambiando estado de usuario ${id} a ${activo}`)
      const { error } = await supabase
        .from('usuarios')
        .update({ activo })
        .eq('id', id)

      if (error) throw error

      console.log(`Estado de usuario ${id} cambiado. Actualizando UI localmente.`)
      setUsuarios(prev => prev.map(user => 
        user.id === id ? { ...user, activo } : user
      ))
      return { error: null }
    } catch (err) {
      console.error('Error cambiando estado:', err)
      return { 
        error: err instanceof Error ? err.message : 'Error al cambiar estado del usuario' 
      }
    }
  }

  // Función para crear un nuevo departamento
  const crearDepartamento = async (nombreDepartamento: string) => {
    try {
      console.log(`Intentando crear departamento: ${nombreDepartamento}`)
      // Verificar si ya existe (ignorando mayúsculas/minúsculas y espacios)
      const nombreNormalizado = nombreDepartamento.trim().toLowerCase()
      const { data: existente, error: checkError } = await supabase
        .from('departamentos')
        .select('id, nombre')
        .ilike('nombre', nombreNormalizado) // Búsqueda case-insensitive
        .maybeSingle() // Puede que no exista

      if (checkError) throw checkError

      if (existente) {
        console.warn(`El departamento "${nombreDepartamento}" ya existe con ID: ${existente.id}`)
        // Devolvemos el existente para evitar duplicados
        return { data: existente as Departamento, error: null }
      }

      // Si no existe, crearlo
      console.log(`Creando nuevo departamento: ${nombreDepartamento.trim()}`)
      const { data, error } = await supabase
        .from('departamentos')
        .insert([{ nombre: nombreDepartamento.trim(), activo: true }]) // Insertar nombre original con trim
        .select()
        .single()

      if (error) throw error
      console.log('Departamento creado:', data)

      // Añadir el nuevo departamento a ambas listas locales para actualizar UI
      if (data) {
        const sortedInsert = (prev: Departamento[]) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre))
        setDepartamentos(sortedInsert)
        setAllDepartamentos(sortedInsert)
      }

      return { data: data as Departamento, error: null }
    } catch (err) {
      console.error('Error creando departamento:', err)
      return { data: null, error: err instanceof Error ? err.message : 'Error al crear departamento' }
    }
  }

  // Función para cambiar el estado activo de un departamento (SOLO SUPERADMIN)
  const toggleDepartamentoActivo = async (id: number, estadoActual?: boolean) => {
    try {
      // 🔒 NOTA DE SEGURIDAD: Esta función debería ser llamada solo después de verificar 
      // que el usuario es superadmin en el componente. Es una medida de seguridad adicional.
      
      // Si no se pasa estadoActual, lo calculamos desde el estado actual
      const departamentoActual = allDepartamentos.find(d => d.id === id)
      const nuevoEstado = estadoActual !== undefined ? !estadoActual : !departamentoActual?.activo
      
      console.log(`Cambiando estado activo del departamento ${id} a ${nuevoEstado}`)
      const { error } = await supabase
        .from('departamentos')
        .update({ activo: nuevoEstado })
        .eq('id', id)

      if (error) throw error
      console.log(`Estado del departamento ${id} cambiado.`)

      // Actualizar ambos estados de departamentos
      const updateFunction = (prev: Departamento[]) =>
        prev.map(dep =>
          dep.id === id ? { ...dep, activo: nuevoEstado } : dep
        )
      
      setDepartamentos(updateFunction) // Departamentos activos
      setAllDepartamentos(updateFunction) // Todos los departamentos
      
      return { error: null }
    } catch (err) {
      console.error('Error cambiando estado del departamento:', err)
      return {
        error: err instanceof Error ? err.message : 'Error al cambiar estado del departamento'
      }
    }
  }

  useEffect(() => {
    fetchUsuarios()
    fetchDepartamentos() // Llamar para obtener departamentos al montar
  }, [fetchUsuarios, fetchDepartamentos]) // Añadir dependencias

  return {
    usuarios,
    departamentos, // Devolver departamentos activos (para selectores)
    allDepartamentos, // Devolver todos los departamentos (para gestión)
    loading,
    loadingDepartamentos, // Devolver estado de carga
    error,
    fetchUsuarios,
    fetchDepartamentos, // Devolver función para recargar departamentos activos
    fetchAllDepartamentos, // Devolver función para recargar todos los departamentos
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario,
    crearDepartamento,
    toggleDepartamentoActivo // Exportar nueva función
  }
} 
