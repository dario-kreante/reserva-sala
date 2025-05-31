'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface Sala {
  id: number
  nombre: string
}

export function useResponsableSalas() {
  const { user, loading: userLoading } = useUser()
  const [salasResponsable, setSalasResponsable] = useState<Sala[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [puedeVerTodo, setPuedeVerTodo] = useState(false)

  useEffect(() => {
    const fetchSalasResponsable = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔄 useResponsableSalas - Iniciando carga para usuario:', user?.id, 'rol:', user?.rol)

        // Si el usuario es superadmin, puede ver todas las salas
        if (user?.rol === 'superadmin') {
          console.log('👤 Usuario es superadmin - acceso a todas las salas')
          setPuedeVerTodo(true)
          
          // Obtener todas las salas para el superadmin
          const { data: todasLasSalas, error: errorSalas } = await supabase
            .from('salas')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre')
          
          if (errorSalas) throw errorSalas
          
          console.log('✅ Salas cargadas para superadmin:', todasLasSalas?.length || 0)
          setSalasResponsable(todasLasSalas || [])
          return
        }
        
        // Si el usuario es admin, obtener solo las salas de las que es responsable
        if (user?.rol === 'admin' && user?.id) {
          console.log('👤 Usuario es admin - buscando salas asignadas')
          setPuedeVerTodo(false)
          
          // Obtener las salas de las que el usuario es responsable
          console.log('🔍 Consultando salas_responsables para usuario:', user.id)
          const { data: relaciones, error: errorResponsables } = await supabase
            .from('salas_responsables')
            .select('sala_id')
            .eq('usuario_id', user.id)
          
          if (errorResponsables) {
            console.error('❌ Error al obtener relaciones sala-responsable:', errorResponsables)
            console.log('🚫 Sin fallback - admin debe tener asignaciones explícitas')
            throw errorResponsables
          }
          
          console.log('📋 Relaciones encontradas:', relaciones?.length || 0)
          
          if (!relaciones || relaciones.length === 0) {
            console.log('⚠️ No se encontraron salas asignadas para admin.')
            console.log('📝 IMPORTANTE: Admin sin asignaciones específicas = sin acceso a salas')
            
            // Si no hay asignaciones específicas, el admin no debería tener acceso a ninguna sala
            setSalasResponsable([])
            return
          }
          
          // Obtener los detalles de las salas
          const salaIds = relaciones.map(rel => rel.sala_id)
          console.log('🏢 IDs de salas asignadas:', salaIds)
          
          const { data: salasData, error: errorSalas } = await supabase
            .from('salas')
            .select('id, nombre')
            .in('id', salaIds)
            .eq('activo', true)
            .order('nombre')
          
          if (errorSalas) {
            console.error('❌ Error al obtener detalles de salas:', errorSalas)
            throw errorSalas
          }
          
          console.log('✅ Salas cargadas para admin:', salasData?.length || 0, salasData?.map(s => s.nombre))
          setSalasResponsable(salasData || [])
          return
        }
        
        // Si el usuario no es admin ni superadmin, no tiene acceso a ninguna sala
        console.log('👤 Usuario sin permisos de administración')
        setPuedeVerTodo(false)
        setSalasResponsable([])
        
      } catch (err) {
        console.error('❌ Error al obtener salas responsable:', err)
        setError(err instanceof Error ? err : new Error('Error desconocido'))
        setSalasResponsable([])
      } finally {
        setLoading(false)
        console.log('🏁 useResponsableSalas - Carga completada')
      }
    }

    // Solo ejecutar si el usuario ya se cargó (no está en loading)
    if (!userLoading) {
      if (user) {
        console.log('✅ Usuario cargado, iniciando carga de salas responsables')
    fetchSalasResponsable()
      } else {
        console.log('⏳ No hay usuario autenticado, estableciendo estado vacío')
        setLoading(false)
        setSalasResponsable([])
        setPuedeVerTodo(false)
      }
    } else {
      console.log('⏳ Esperando a que termine la carga del usuario...')
    }
  }, [user, userLoading])

  return {
    salasResponsable,
    loading,
    error,
    puedeVerTodo,
    esSuperAdmin: user?.rol === 'superadmin',
    esAdmin: user?.rol === 'admin'
  }
} 