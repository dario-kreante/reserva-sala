import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface UserReserva {
  id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  es_urgente: boolean
  sala: {
    id: number
    nombre: string
  }
}

export function useUserReservas() {
  const [reservas, setReservas] = useState<UserReserva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useUser()

  const fetchUserReservas = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reservas')
        .select<any, UserReserva>(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          es_urgente,
          sala:salas (
            id,
            nombre
          )
        `)
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false })

      if (error) throw error

      setReservas(data || [])
    } catch (err) {
      console.error('Error fetching user reservas:', err)
      setError('No se pudieron cargar tus reservas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchUserReservas()
    }
  }, [user])

  return {
    reservas,
    loading,
    error,
    fetchUserReservas
  }
} 