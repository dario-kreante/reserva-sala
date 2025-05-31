import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

// Contador global para solicitudes
let requestCounter = 0;

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
  es_reserva_sistema: boolean
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
  comentario: string | null
  // Campos académicos para reservas del sistema
  nombre_modulo: string | null
  profesor_responsable: string | null
  descripcion: string | null
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
          es_reserva_sistema,
          solicitante_nombre_completo,
          institucion,
          comentario,
          nombre_modulo,
          profesor_responsable,
          descripcion,
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

  const fetchHorariosOcupados = async (salaId: number, fechaStr: string, caller: string = 'no-identificado') => {
    let requestId = requestCounter++;
    console.log(`[${requestId}] fetchHorariosOcupados llamado desde ${caller} - sala: ${salaId}, fecha: ${fechaStr}`);
    
    try {
      setLoadingHorarios(true);
      setError(null);
      
      // Normalizar formato de fecha
      let fechaFormateada = fechaStr;
      console.log(`[${requestId}] Fecha original: ${fechaStr}`);
      
      // Si la fecha viene en formato DD/MM/YYYY, convertir a YYYY-MM-DD
      if (fechaStr.includes('/')) {
        const [dia, mes, anio] = fechaStr.split('/');
        fechaFormateada = `${anio}-${mes}-${dia}`;
        console.log(`[${requestId}] Fecha convertida de DD/MM/YYYY a YYYY-MM-DD: ${fechaFormateada}`);
      }
      
      // Validar que la fecha sea válida
      if (!fechaFormateada.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error(`[${requestId}] Formato de fecha inválido: ${fechaFormateada}`);
        setLoadingHorarios(false);
        setHorariosOcupados([]);
        return [];
      }
      
      console.log(`[${requestId}] Consultando horarios ocupados para sala ${salaId} en fecha ${fechaFormateada}`);
      
      // Limpiar horarios ocupados anteriores antes de obtener nuevos
      setHorariosOcupados([]);
      
      // Obtener reservas para la fecha y sala específicas
      const { data, error } = await supabase
        .from('reservas')
        .select('hora_inicio, hora_fin, estado')
        .eq('fecha', fechaFormateada)
        .eq('sala_id', salaId)
        .in('estado', ['pendiente', 'aprobada']);
        
      if (error) {
        console.error(`[${requestId}] Error al obtener horarios ocupados:`, error);
        setError(error.message);
        setLoadingHorarios(false);
        return [];
      }
      
      console.log(`[${requestId}] Resultado de la consulta:`, data);
      
      if (data && data.length > 0) {
        // Formatear los horarios
        const horarios = data.map(reserva => ({
          hora_inicio: reserva.hora_inicio,
          hora_fin: reserva.hora_fin
        }));
        
        // Ordenar los horarios por hora de inicio
        const horariosOrdenados = [...horarios].sort((a, b) => {
          return a.hora_inicio.localeCompare(b.hora_inicio);
        });
        
        setHorariosOcupados(horariosOrdenados);
        console.log(`[${requestId}] Horarios ocupados establecidos (ordenados):`, horariosOrdenados);
        setLoadingHorarios(false);
        return horariosOrdenados;
      } else {
        console.log(`[${requestId}] No se encontraron horarios ocupados`);
        setHorariosOcupados([]);
        setLoadingHorarios(false);
        return [];
      }
    } catch (err) {
      console.error(`[${requestId}] Error en fetchHorariosOcupados:`, err);
      setError(err instanceof Error ? err.message : String(err));
      setLoadingHorarios(false);
      return [];
    }
  };

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

