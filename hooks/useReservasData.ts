import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

interface Sala {
  id: number
  nombre: string
  tipo: string
  capacidad: number
  centro: string
  descripcion: string | null
}

interface ReservaResponse {
  id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
  es_urgente: boolean
  es_externo: boolean
  solicitante_nombre_completo: string | null
  institucion: string | null
  sala: {
    id: number
    nombre: string
    tipo: string
  } | null
  usuario: {
    id: string
    nombre: string
    apellido: string
    rol: string
  } | null
}

interface ReservaDB {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  es_urgente: boolean;
  usuario_id: string;
  sala: {
    id: number;
    nombre: string;
  } | null;
}

interface HorarioOcupado {
  hora_inicio: string;
  hora_fin: string;
}

export function useReservasData() {
  const [reservas, setReservas] = useState<ReservaResponse[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [loadingSalas, setLoadingSalas] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [horariosOcupados, setHorariosOcupados] = useState<HorarioOcupado[]>([])
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useUser()

  const fetchReservas = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reservas')
        .select<any, ReservaResponse>(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          es_urgente,
          es_externo,
          solicitante_nombre_completo,
          institucion,
          sala:salas (
            id,
            nombre,
            tipo
          ),
          usuario:usuarios (
            id,
            nombre,
            apellido,
            rol
          )
        `)
        .order('fecha', { ascending: false })

      if (error) throw error

      setReservas(data || [])
    } catch (error) {
      console.error('Error fetching reservas:', error)
      setError('No se pudieron cargar las reservas')
    } finally {
      setLoading(false)
    }
  }

  const fetchSalas = async () => {
    try {
      setLoadingSalas(true)
      const { data, error } = await supabase
        .from('salas')
        .select('id, nombre, tipo, capacidad, centro, descripcion')
        .order('nombre')

      if (error) throw error

      console.log('Salas recuperadas:', data)
      setSalas(data || [])
    } catch (error) {
      console.error('Error fetching salas:', error)
      setError('No se pudieron cargar las salas')
    } finally {
      setLoadingSalas(false)
    }
  }

  const fetchHorariosOcupados = async (salaId: number, fecha: string) => {
    setLoadingHorarios(true)
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select('hora_inicio, hora_fin')
        .eq('sala_id', salaId)
        .eq('fecha', fecha)
        .in('estado', ['pendiente', 'aprobada'])
        .order('hora_inicio')

      if (error) throw error
      setHorariosOcupados(data || [])
    } catch (error) {
      console.error('Error fetching horarios ocupados:', error)
      setError('No se pudieron cargar los horarios ocupados')
    } finally {
      setLoadingHorarios(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchReservas()
      fetchSalas()
    }
  }, [user])

  return {
    reservas,
    salas,
    loadingSalas,
    horariosOcupados,
    loadingHorarios,
    error,
    fetchReservas,
    fetchSalas,
    fetchHorariosOcupados,
    loading
  }
}

