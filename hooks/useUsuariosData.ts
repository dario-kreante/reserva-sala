import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  rut: string
  rol: string
  departamento: string | null
  activo: boolean
  created_at: string
}

export function useUsuariosData() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('apellido')

      if (error) throw error

      setUsuarios(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const crearUsuario = async (nuevoUsuario: Omit<Usuario, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .insert([nuevoUsuario])
        .select()
        .single()

      if (error) throw error

      setUsuarios(prev => [...prev, data])
      return { data, error: null }
    } catch (err) {
      console.error('Error:', err)
      return { data: null, error: err instanceof Error ? err.message : 'Error al crear usuario' }
    }
  }

  const actualizarUsuario = async (id: string, datos: Partial<Usuario>) => {
    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update(datos)
        .eq('id', id)

      if (updateError) throw updateError

      const { data: usuarioActualizado, error: fetchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      setUsuarios(prev => prev.map(user => user.id === id ? usuarioActualizado : user))
      return { data: usuarioActualizado, error: null }
    } catch (err) {
      console.error('Error:', err)
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Error al actualizar usuario' 
      }
    }
  }

  const cambiarEstadoUsuario = async (id: string, activo: boolean) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo })
        .eq('id', id)

      if (error) throw error

      setUsuarios(prev => prev.map(user => 
        user.id === id ? { ...user, activo } : user
      ))
      return { error: null }
    } catch (err) {
      console.error('Error:', err)
      return { 
        error: err instanceof Error ? err.message : 'Error al cambiar estado del usuario' 
      }
    }
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario
  }
} 