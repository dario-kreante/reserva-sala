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
          
          // Intentar obtener los IDs de las salas de las que el usuario es responsable
          console.log('Intentando consultar salas_responsables para usuario:', user.id)
          const { data: relaciones, error: errorResponsables } = await supabase
            .from('salas_responsables')
            .select('*')
            .eq('usuario_id', user.id)
          
          if (errorResponsables) {
            console.error('Error al obtener relaciones sala-responsable:', errorResponsables)
            console.error('Error code:', errorResponsables.code)
            console.error('Error message:', errorResponsables.message)
            console.error('Error details:', errorResponsables.details)
            
            // Si hay error (tabla no existe o no hay datos), temporalmente permitir que los admins vean todas las salas
            console.log('Fallback: permitiendo acceso a todas las salas para admin')
            const { data: todasLasSalas, error: errorSalas } = await supabase
              .from('salas')
              .select('id, nombre')
              .eq('activo', true)
              .order('nombre')
            
            if (errorSalas) throw errorSalas
            
            console.log('Salas obtenidas en fallback:', todasLasSalas)
            setSalasResponsable(todasLasSalas || [])
            return
          }
          
          console.log('Relaciones encontradas para usuario:', user.id, relaciones)
          console.log('Estructura de relaciones:', JSON.stringify(relaciones, null, 2))
          
          if (!relaciones || relaciones.length === 0) {
            console.log('No se encontraron salas asignadas para el usuario. Por ahora, permitir acceso a todas las salas.')
            
            // Temporalmente, si no hay asignaciones, permitir ver todas las salas
            const { data: todasLasSalas, error: errorSalas } = await supabase
              .from('salas')
              .select('id, nombre')
              .eq('activo', true)
              .order('nombre')
            
            if (errorSalas) throw errorSalas
            
            console.log('Salas obtenidas para usuario sin asignaciones:', todasLasSalas)
            setSalasResponsable(todasLasSalas || [])
            return
          }
          
          // Obtener los detalles de las salas
          const salaIds = relaciones.map(rel => rel.sala_id)
          console.log('IDs de salas a buscar:', salaIds)
          
          const { data: salasData, error: errorSalas } = await supabase
            .from('salas')
            .select('id, nombre')
            .in('id', salaIds)
            .eq('activo', true)
            .order('nombre')
          
          if (errorSalas) {
            console.error('Error al obtener detalles de salas:', errorSalas)
            throw errorSalas
          }
          
          console.log('Salas encontradas para usuario con asignaciones:', salasData)
          setSalasResponsable(salasData || [])
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