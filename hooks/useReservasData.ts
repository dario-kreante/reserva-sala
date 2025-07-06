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
  telefono: string | null
  mail_externos: string | null
  created_at: string | null
  ultima_actualizacion: string | null
  sala: {
    id: number
    nombre: string
    tipo: string
    capacidad: number | null
    centro: string | null
  } | null
  usuario: {
    id: string
    nombre: string
    apellido: string
    rol: string
    email: string | null
    departamento: string | null
  } | null
  comentario: string | null
  motivo_rechazo: string | null
  // Campos académicos para reservas del sistema
  nombre_modulo: string | null
  codigo_asignatura: string | null
  seccion: string | null
  profesor_responsable: string | null
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
      console.log('🔄 useReservasData - Iniciando fetchReservas...')
      
      // DIAGNÓSTICO: Verificar el total de reservas en la base de datos
      const { count, error: countError } = await supabase
        .from('reservas')
        .select('*', { count: 'exact', head: true })
      
      if (!countError) {
        console.log('📊 useReservasData - Total de reservas en DB:', count)
      }
      
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
          telefono,
          mail_externos,
          created_at,
          ultima_actualizacion,
          comentario,
          motivo_rechazo,
          nombre_modulo,
          codigo_asignatura,
          seccion,
          profesor_responsable,
          sala:salas!inner (
            id,
            nombre,
            tipo,
            capacidad,
            centro
          ),
          usuario:usuarios (
            id,
            nombre,
            apellido,
            rol,
            email,
            departamento
          )
        `)
        .eq('sala.activo', true)
        .order('fecha', { ascending: false })

      if (error) throw error

      console.log('✅ useReservasData - Reservas obtenidas:', data?.length || 0)
      console.log('📋 useReservasData - Primeras 3 reservas:', data?.slice(0, 3))
      console.log('🔍 useReservasData - Tipos de reservas:', {
        sistema: data?.filter(r => r.es_reserva_sistema).length || 0,
        externas: data?.filter(r => r.es_externo).length || 0,
        normales: data?.filter(r => !r.es_reserva_sistema && !r.es_externo).length || 0
      })

      setReservas(data || [])
    } catch (error) {
      console.error('❌ useReservasData - Error fetching reservas:', error)
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
        .eq('activo', true)
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
      
      // Verificar que la sala existe y está activa antes de consultar horarios
      const { data: salaData, error: salaError } = await supabase
        .from('salas')
        .select('activo')
        .eq('id', salaId)
        .single();
        
      if (salaError || !salaData || !salaData.activo) {
        console.log(`[${requestId}] Sala ${salaId} no existe o está inactiva - no se devuelven horarios ocupados`);
        setHorariosOcupados([]);
        setLoadingHorarios(false);
        return [];
      }
      
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

