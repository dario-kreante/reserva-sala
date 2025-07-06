import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface UserReserva {
  id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
  es_urgente: boolean
  comentario?: string
  motivo_rechazo?: string
  es_externo: boolean
  solicitante_nombre_completo?: string
  institucion?: string
  sala: {
    id: number
    nombre: string
  }
}

export function useUserReservas() {
  const [reservas, setReservas] = useState<UserReserva[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const { user } = useUser()

  const ITEMS_PER_PAGE = 10

  const fetchUserReservas = async (reset = true) => {
    if (!user?.id) return

    try {
      if (reset) {
        setLoading(true)
        setCurrentPage(0)
      } else {
        setLoadingMore(true)
      }

      const page = reset ? 0 : currentPage + 1
      const from = page * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error, count } = await supabase
        .from('reservas')
        .select<any, UserReserva>(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          es_urgente,
          comentario,
          motivo_rechazo,
          es_externo,
          solicitante_nombre_completo,
          institucion,
          sala:salas (
            id,
            nombre
          )
        `, { count: 'exact' })
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      const newReservas = data || []
      
      if (reset) {
        setReservas(newReservas)
      } else {
        setReservas(prev => [...prev, ...newReservas])
      }

      setCurrentPage(page)
      
      // Verificar si hay más datos
      const totalLoaded = (page + 1) * ITEMS_PER_PAGE
      setHasMore(count ? totalLoaded < count : newReservas.length === ITEMS_PER_PAGE)

    } catch (err) {
      console.error('Error fetching user reservas:', err)
      setError('No se pudieron cargar tus reservas')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchUserReservas(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchUserReservas(true)
    }
  }, [user])

  return {
    reservas,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchUserReservas: () => fetchUserReservas(true),
    loadMore
  }
} 