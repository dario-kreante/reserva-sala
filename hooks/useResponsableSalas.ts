'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface Sala {
  id: number
  nombre: string
}

export function useResponsableSalas() {
  const { user } = useUser()
  const [salasResponsable, setSalasResponsable] = useState<Sala[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [puedeVerTodo, setPuedeVerTodo] = useState(false)

  useEffect(() => {
    const fetchSalasResponsable = async () => {
      try {
        setLoading(true)
        setError(null)

        // Si el usuario es superadmin, puede ver todas las salas
        if (user?.rol === 'superadmin') {
          setPuedeVerTodo(true)
          
          // Obtener todas las salas para el superadmin
          const { data: todasLasSalas, error: errorSalas } = await supabase
            .from('salas')
            .select('id, nombre')
            .order('nombre')
          
          if (errorSalas) throw errorSalas
          
          setSalasResponsable(todasLasSalas || [])
          return
        }
        
        // Si el usuario es admin, obtener solo las salas de las que es responsable
        if (user?.rol === 'admin' && user?.id) {
          setPuedeVerTodo(false)
          
          // Obtener las salas de las que el usuario es responsable
          const { data: salasData, error: errorResponsables } = await supabase
            .from('salas_responsables')
            .select(`
              sala_id,
              salas:sala_id(id, nombre)
            `)
            .eq('usuario_id', user.id)
          
          if (errorResponsables) throw errorResponsables
          
          // Transformar los datos para obtener un array de salas
          const salas = salasData?.map(item => ({
            id: item.salas.id,
            nombre: item.salas.nombre
          })) || []
          
          setSalasResponsable(salas)
          return
        }
        
        // Si el usuario no es admin ni superadmin, no tiene acceso a ninguna sala
        setPuedeVerTodo(false)
        setSalasResponsable([])
        
      } catch (err) {
        console.error('Error al obtener salas responsable:', err)
        setError(err instanceof Error ? err : new Error('Error desconocido'))
        setSalasResponsable([])
      } finally {
        setLoading(false)
      }
    }

    fetchSalasResponsable()
  }, [user])

  return {
    salasResponsable,
    loading,
    error,
    puedeVerTodo,
    esSuperAdmin: user?.rol === 'superadmin',
    esAdmin: user?.rol === 'admin'
  }
} 