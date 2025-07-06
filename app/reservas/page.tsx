"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from '@/lib/supabase'
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/ui/combobox"
import { UserSelect } from "@/components/ui/user-select"
import { useReservasData } from '@/hooks/useReservasData'
import { useResponsableSalas } from '@/hooks/useResponsableSalas'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Loader2, Check, X, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUser } from '@/hooks/useUser'
import { validarReserva, hayConflictoHorario, validarHorarioConsistente } from '@/utils/horarioValidation'

interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  rut: string
  rol: string
  departamento: string | null
}

interface NuevaReserva {
  usuario_id: string
  sala_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  comentario?: string
  es_urgente: boolean
  es_externo: boolean
  solicitante_nombre_completo?: string
  institucion?: string
  telefono?: string
  mail_externos?: string
}

interface Sala {
  id: number
  nombre: string
}

export default function Reservas() {
  // NOTA IMPORTANTE:
  // Para usuarios admin:
  // - En el formulario de creación de reservas: pueden ver y seleccionar TODAS las salas activas
  // - En la lista de reservas y aprobaciones: solo ven las reservas de las salas de las que son responsables
  //   Si no son responsables de ninguna sala, no deberían ver ninguna reserva.
  // 
  // Esto permite que los admin creen reservas en cualquier sala, pero solo puedan aprobar/rechazar
  // reservas en las salas asignadas a ellos.
  
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [reservas, setReservas] = useState<any[]>([])
  const [reservasHistoricas, setReservasHistoricas] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('actuales')
  const [nuevaReserva, setNuevaReserva] = useState<NuevaReserva>({
    usuario_id: '',
    sala_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    estado: 'pendiente',
    es_urgente: false,
    es_externo: false
  })
  const [mostrarHistoricas, setMostrarHistoricas] = useState(false)
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [salasLocales, setSalasLocales] = useState<Sala[]>([])
  const [mostrarReservasSistema, setMostrarReservasSistema] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [filtroSala, setFiltroSala] = useState<string>('todas')
  const [busquedaReserva, setBusquedaReserva] = useState('')
  const { fetchHorariosOcupados, horariosOcupados, salas, loadingSalas } = useReservasData()
  const [selectedSala, setSelectedSala] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const { 
    salasResponsable, 
    loading: loadingSalasResponsable, 
    puedeVerTodo,
    esSuperAdmin,
    esAdmin
  } = useResponsableSalas()
  const [loading, setLoading] = useState(false)
  const { user } = useUser()
  const { toast } = useToast()

  // Estado para el diálogo de rechazo con comentario
  const [dialogoRechazoAbierto, setDialogoRechazoAbierto] = useState(false)
  const [reservaIdParaRechazar, setReservaIdParaRechazar] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // Añadir un nuevo estado para controlar la alerta de éxito
  const [mostrarAlertaExito, setMostrarAlertaExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Añadir referencias para prevenir llamadas duplicadas
  const prevSelectedDate = useRef<string | null>(null);
  const prevSelectedSala = useRef<string | null>(null);
  // Agregar contador de solicitudes
  const requestId = useRef(0);
  
  // Añadir un nuevo estado para controlar la validación de horarios
  const [conflictoHorario, setConflictoHorario] = useState<boolean>(false)
  const [mensajeConflicto, setMensajeConflicto] = useState<string>('')
  
  // Añadir un estado para controlar la inicialización
  const [initialized, setInitialized] = useState(false)
  const fetchInProgress = useRef(false)
  
  // Mover esta verificación arriba, fuera del renderizado
  const adminSinSalas = esAdmin && !esSuperAdmin && salasResponsable.length === 0;

  // Funciones auxiliares para formatear fechas y horas
  const formatFecha = (fechaStr: string) => {
    try {
      // Usar el formato de fecha original YYYY-MM-DD y convertirlo a formato local
      const [year, month, day] = fechaStr.split('-').map(Number);
      const fecha = new Date(year, month - 1, day);
      return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return fechaStr; // Devolver la fecha original si hay error
    }
  }
  
  const formatHora = (horaStr: string) => {
    try {
      // Formatear horas tipo "08:30:00" a "8:30"
      return horaStr.substring(0, 5);
    } catch (error) {
      console.error('Error al formatear hora:', error);
      return horaStr; // Devolver la hora original si hay error
    }
  }
  
  // Función memoizada para fetchHorariosOcupados para evitar recreaciones innecesarias
  const fetchOcupados = useCallback(
    async (salaId: number, fechaStr: string, caller: string) => {
      const currentRequestId = ++requestId.current;
      console.log(`[Reservas ${currentRequestId}] Consultando horarios ocupados: sala=${salaId}, fecha=${fechaStr}, origen=${caller}`);
      return fetchHorariosOcupados(salaId, fechaStr, `Reservas-${caller}`);
    },
    [fetchHorariosOcupados]
  );

  const fetchUsuarios = async () => {
    if (usuarios.length > 0) return;
    
    // Salir rápidamente si es un admin sin salas asignadas (pero permitir a superadmin)
    if (adminSinSalas && !esSuperAdmin) {
      console.log('Admin sin salas: omitiendo carga de usuarios');
      return;
    }
    
    // Evitar llamadas duplicadas durante la carga
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    
    console.log('Cargando usuarios...');
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, nombre, apellido, rut, rol, departamento')
        .eq('activo', true)
        .order('apellido')

      if (error) {
        console.error('Error fetching usuarios:', error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los usuarios",
          variant: "destructive",
        })
        return
      }

      console.log(`Se cargaron ${data?.length || 0} usuarios`);
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error general al cargar usuarios:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      fetchInProgress.current = false;
    }
  }

  const fetchReservas = async () => {
    // Salir rápidamente si es un admin sin salas asignadas (pero permitir a superadmin)
    if (adminSinSalas && !esSuperAdmin) {
      console.log('Admin sin salas: omitiendo carga de reservas');
      setReservas([]);
      setReservasHistoricas([]);
      return;
    }
    
    const today = new Date().toISOString().split('T')[0]
    const SISTEMA_UUID = '4a8794b5-139a-4d5d-a9da-dc2873665ca9'
    
    try {
      // Reservas actuales y futuras
      let queryActuales = supabase
        .from('reservas')
        .select(`
          *,
          sala:salas!inner(id, nombre),
          usuario:usuarios(id, nombre, apellido, email, rol)
        `)
        .eq('sala.activo', true)  // Filtrar solo reservas de salas activas
        .gte('fecha', today)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })

      // Si el usuario es admin (no superadmin), filtrar por las salas de las que es responsable
      // IMPORTANTE: Los superadmin deben ver todas las reservas sin filtrar por salas
      if (esAdmin && !esSuperAdmin) {
        // Solo mostrar reservas si el administrador es responsable de al menos una sala
        if (salasResponsable.length > 0) {
          const salaIds = salasResponsable.map(sala => sala.id)
          queryActuales = queryActuales.in('sala_id', salaIds)
        } else {
          // Si el admin no es responsable de ninguna sala, no mostrar reservas
          console.log('Admin no es responsable de ninguna sala: no se muestran reservas')
          setReservas([])
          setReservasHistoricas([])
          return
        }
      }
      // Si es superadmin, verá todas las reservas (no aplicamos filtros)
      else if (esSuperAdmin) {
        console.log('Superadmin: mostrando todas las reservas sin filtros')
      }

      const { data: actuales, error: errorActuales } = await queryActuales

      if (errorActuales) {
        console.error('Error fetching reservas actuales:', errorActuales)
        return
      }

      // Reservas históricas con el mismo filtro
      let queryHistoricas = supabase
        .from('reservas')
        .select(`
          *,
          sala:salas!inner(id, nombre),
          usuario:usuarios(id, nombre, apellido, email, rol)
        `)
        .eq('sala.activo', true)  // Filtrar solo reservas de salas activas
        .lt('fecha', today)
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: true })

      // Aplicar la misma lógica de filtrado para las reservas históricas
      if (esAdmin && !esSuperAdmin) {
        // Solo mostrar reservas si el administrador es responsable de al menos una sala
        if (salasResponsable.length > 0) {
          const salaIds = salasResponsable.map(sala => sala.id)
          queryHistoricas = queryHistoricas.in('sala_id', salaIds)
        } else {
          // Este return ya se ejecutó arriba, pero para mantener coherencia lo dejamos
          return
        }
      }
      // Si es superadmin, verá todas las reservas históricas (no aplicamos filtros)
      else if (esSuperAdmin) {
        console.log('Superadmin: mostrando todas las reservas históricas sin filtros')
      }

      const { data: historicas, error: errorHistoricas } = await queryHistoricas

      if (errorHistoricas) {
        console.error('Error fetching reservas históricas:', errorHistoricas)
        return
      }

      // Filtrar las reservas según el toggle
      const filtrarReservas = (reservas: any[]) => {
        if (!mostrarReservasSistema) {
          return reservas.filter(r => r.usuario_id !== SISTEMA_UUID)
        }
        return reservas
      }

      setReservas(filtrarReservas(actuales || []))
      setReservasHistoricas(filtrarReservas(historicas || []))
    } catch (error) {
      console.error('Error general al obtener reservas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas",
        variant: "destructive",
      })
    }
  }

  const fetchSalas = async () => {
    if (salasLocales.length > 0 && !loadingSalasResponsable) return;
    
    console.log('Cargando salas...');
    setLoading(true);
    
    try {
      if (!loadingSalasResponsable) {
        // Para admin (no superadmin): usar solo las salas de las que es responsable
        if (esAdmin && !esSuperAdmin) {
          console.log('Usuario admin: usando salas responsables para formulario y filtros');
          setSalasLocales(salasResponsable);
        }
        // Para superadmin: obtener todas las salas activas
        else if (esSuperAdmin) {
          console.log('Superadmin: cargando todas las salas activas');
          
          const { data, error } = await supabase
            .from('salas')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');
            
          if (error) throw error;
          
          console.log(`Obtenidas ${data?.length || 0} salas activas para superadmin`);
          setSalasLocales(data || []);
        } else {
          // Para otros roles, usar las salas responsables
          console.log(`Usando ${salasResponsable.length} salas responsables`);
          setSalasLocales(salasResponsable);
        }
      }
    } catch (error) {
      console.error('Error al cargar salas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las salas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Cargar datos solo cuando el usuario esté autenticado y tengamos información sobre las salas responsables
    if (!loadingSalasResponsable) {
      // Marcar como inicializado para controlar el renderizado
      setInitialized(true);
    
      // Primero cargar las salas, que es lo más rápido
      fetchSalas();
      
      // Si es admin sin salas (no superadmin), no cargar usuarios ni reservas
      // Para superadmin, siempre cargar todo sin importar las salas asignadas
      if (adminSinSalas && !esSuperAdmin) {
        console.log('Admin sin salas: omitiendo carga de usuarios y reservas');
        return;
      }

      // Si es superadmin, indicarlo en el log
      if (esSuperAdmin) {
        console.log('Superadmin: cargando todos los datos sin restricciones');
      }
      
      // Luego cargar los usuarios, que puede tomar más tiempo
      // Usar setTimeout para no bloquear la interfaz
      setTimeout(() => {
        fetchUsuarios();
      }, 100);
      
      // Finalmente cargar las reservas, que es lo más pesado
      setTimeout(() => {
        fetchReservas();
      }, 200);
    }
  }, [loadingSalasResponsable, salasResponsable, esAdmin, esSuperAdmin, adminSinSalas]);

  // Función para inspeccionar las fechas de las reservas
  useEffect(() => {
    if (reservas.length > 0) {
      console.log("=== INSPECCIÓN DE FECHAS EN RESERVAS ===");
      reservas.slice(0, 5).forEach((reserva, index) => {
        console.log(`Reserva ${index+1}:`);
        console.log(`  ID: ${reserva.id}`);
        console.log(`  Fecha en DB: ${reserva.fecha}`);
        console.log(`  Fecha parseada: ${new Date(reserva.fecha).toISOString()}`);
        console.log(`  Fecha formateada: ${new Date(reserva.fecha).toLocaleDateString('es-ES')}`);
        console.log(`  Sala: ${reserva.sala?.nombre || 'Sin sala'}`);
      });
      console.log("======================================");
    }
  }, [reservas]);

  // Agregar un nuevo useEffect para recargar reservas cuando cambie mostrarReservasSistema
  useEffect(() => {
    if (!loadingSalasResponsable) {
      fetchReservas();
    }
  }, [mostrarReservasSistema]);

  // Añadir un nuevo useEffect para manejar el cambio en salasResponsable
  useEffect(() => {
    if (salasResponsable.length > 0 && !loadingSalasResponsable) {
      // Para usuarios admin, no actualizar las salas locales aquí
      // ya que queremos mostrar todas las salas activas, no solo las responsables
      if (!esAdmin) {
        // Para otros roles, actualizar las salas locales cuando cambien las salas responsables
        setSalasLocales(salasResponsable);
        console.log(`Salas responsables actualizadas: ${salasResponsable.length} salas`);
      }
    }
  }, [salasResponsable, loadingSalasResponsable, esAdmin]);

  // Reemplazar el useEffect existente con una versión mejorada que evita llamadas duplicadas
  useEffect(() => {
    if (selectedSala && selectedDate) {
      // IMPORTANTE: Asegurar que la fecha esté correcta respetando la zona horaria local
      // El problema era que al usar toISOString o formato diferente se cambiaba el día por zona horaria
      // La fecha seleccionada es la fecha local sin horas, así que debemos mantenerla igual
      
      // Crear una fecha sin tiempo, solo con la parte de fecha (YYYY-MM-DD)
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      // Almacenar la fecha original para depuración
      console.log(`Fecha seleccionada original: ${selectedDate.toDateString()}`);
      console.log(`Fecha formateada para consulta: ${formattedDate}`);
      
      // Verificar si es la misma consulta que ya hicimos para evitar duplicados
      const currentKey = `${selectedSala}-${formattedDate}`;
      const previousKey = `${prevSelectedSala.current}-${prevSelectedDate.current}`;
      
      if (currentKey !== previousKey) {
        console.log(`Llamando a fetchHorariosOcupados desde useEffect con salaId=${selectedSala} y fecha=${formattedDate}`);
        
        // Actualizamos las referencias para la próxima verificación
        prevSelectedSala.current = selectedSala;
        prevSelectedDate.current = formattedDate;
        
        // Realizamos la consulta
        fetchOcupados(Number(selectedSala), formattedDate, 'useEffect-principal');
      } else {
        console.log(`Omitiendo consulta duplicada: ${currentKey} es igual a ${previousKey}`);
      }
    }
  }, [selectedSala, selectedDate, fetchOcupados]);

  // Añadir un nuevo useEffect para establecer el usuario actual como valor predeterminado
  useEffect(() => {
    if (user && user.id && nuevaReserva.usuario_id === '') {
      setNuevaReserva(prev => ({
        ...prev,
        usuario_id: user.id
      }));
      console.log('Usuario actual establecido como predeterminado:', user.id);
    }
  }, [user]);

  const USUARIO_EXTERNO_ID = '14ed3494-2f73-4db6-970d-3026d2c59541'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Iniciando creación de reserva...')
    
    try {
      // Verificar el comentario primero, antes que otros campos
      if (!nuevaReserva.comentario?.trim()) {
        console.log('Falta el comentario:', nuevaReserva)
        toast({
          title: "Campo requerido",
          description: "El comentario es obligatorio. Por favor, indica el motivo o detalles de la reserva.",
          variant: "destructive",
        })
        return
      }

      // Verificar otros campos obligatorios
      if (!nuevaReserva.sala_id || !nuevaReserva.fecha || !nuevaReserva.hora_inicio || !nuevaReserva.hora_fin) {
        console.log('Faltan campos obligatorios:', nuevaReserva)
        toast({
          title: "Error",
          description: "Debes completar todos los campos obligatorios",
          variant: "destructive",
        })
        return
      }

      // Verificar campos adicionales para reservas externas
      if (nuevaReserva.es_externo && (!nuevaReserva.solicitante_nombre_completo || !nuevaReserva.institucion || !nuevaReserva.mail_externos)) {
        console.log('Faltan campos obligatorios para reserva externa:', nuevaReserva)
        toast({
          title: "Error",
          description: "Debes completar todos los campos obligatorios para reservas externas",
          variant: "destructive",
        })
        return
      }

      // Verificar que la fecha no sea anterior a la fecha actual
      const fechaHoraChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
      const [year, month, day] = nuevaReserva.fecha.split('-').map(Number)
      const fechaSeleccionada = new Date(year, month - 1, day)
      
      // Si es el mismo día, validar que la hora no haya pasado
      if (fechaSeleccionada.getDate() === fechaHoraChile.getDate() &&
          fechaSeleccionada.getMonth() === fechaHoraChile.getMonth() &&
          fechaSeleccionada.getFullYear() === fechaHoraChile.getFullYear()) {
        
        const [horaInicio, minutoInicio] = nuevaReserva.hora_inicio.split(':').map(Number)
        const horaInicioDate = new Date(year, month - 1, day, horaInicio, minutoInicio)
        
        if (horaInicioDate < fechaHoraChile) {
          console.log('Hora de inicio ya pasó:', horaInicioDate, fechaHoraChile)
          toast({
            title: "Error",
            description: "No se pueden realizar reservas en horarios pasados",
            variant: "destructive",
          })
          return
        }
      }

      // Validar días anteriores
      fechaHoraChile.setHours(0, 0, 0, 0)
      fechaSeleccionada.setHours(0, 0, 0, 0)
      
      if (fechaSeleccionada < fechaHoraChile) {
        console.log('Fecha pasada:', fechaSeleccionada, fechaHoraChile)
        toast({
          title: "Error",
          description: "No se pueden realizar reservas en fechas pasadas",
          variant: "destructive",
        })
        return
      }

      // Validar que la hora de fin sea posterior a la de inicio
      if (!validarHorarioConsistente(nuevaReserva.hora_inicio, nuevaReserva.hora_fin)) {
        console.log('Horario inconsistente:', nuevaReserva.hora_inicio, nuevaReserva.hora_fin)
        toast({
          title: "Error",
          description: "La hora de fin debe ser posterior a la hora de inicio",
          variant: "destructive",
        })
        return
      }

      // Preparar los datos de la reserva
      const reservaData = {
        sala_id: Number(nuevaReserva.sala_id),
        fecha: nuevaReserva.fecha,
        hora_inicio: `${nuevaReserva.hora_inicio}:00`,
        hora_fin: `${nuevaReserva.hora_fin}:00`,
        usuario_id: nuevaReserva.es_externo ? USUARIO_EXTERNO_ID : nuevaReserva.usuario_id,
        estado: 'pendiente',
        es_urgente: nuevaReserva.es_urgente,
        es_externo: nuevaReserva.es_externo,
        comentario: nuevaReserva.comentario || null
      }

      // Agregar campos para reservas externas
      if (nuevaReserva.es_externo) {
        Object.assign(reservaData, {
          solicitante_nombre_completo: nuevaReserva.solicitante_nombre_completo,
          institucion: nuevaReserva.institucion,
          mail_externos: nuevaReserva.mail_externos,
          telefono: nuevaReserva.telefono || null
        })
      }

      console.log('Intentando crear reserva con datos:', reservaData)

      // Crear la reserva
      const { data, error } = await supabase
        .from('reservas')
        .insert(reservaData)
        .select()

      if (error) {
        console.error('Error al crear la reserva:', error)
        throw error
      }

      console.log('Reserva creada exitosamente:', data)

      // Mostrar mensaje de éxito
      toast({
        title: "Éxito",
        description: "La reserva ha sido creada exitosamente",
      })

      // Mostrar alerta de éxito
      setMensajeExito("¡La reserva ha sido creada exitosamente!")
      setMostrarAlertaExito(true)
      
      // Ocultar la alerta después de 5 segundos
      setTimeout(() => {
        setMostrarAlertaExito(false)
      }, 5000)

      // Limpiar formulario
      setNuevaReserva({
        usuario_id: user?.id || '',
        sala_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        estado: 'pendiente',
        es_urgente: false,
        es_externo: false
      })

      // Actualizar la lista de reservas
      fetchReservas()

    } catch (error) {
      console.error('Error detallado:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear la reserva",
        variant: "destructive",
      })
    }
  }

  const usuariosFiltrados = usuarios.filter(usuario => 
    `${usuario.nombre} ${usuario.apellido} ${usuario.rol}`
      .toLowerCase()
      .includes(busquedaUsuario.toLowerCase())
  )

  const handleCambioEstado = async (reservaId: string, nuevoEstado: 'aprobada' | 'rechazada', motivoRechazo?: string) => {
    try {
      const updateData: any = { estado: nuevoEstado }
      
      // Si hay motivo de rechazo, añadirlo a los datos de actualización
      if (motivoRechazo && nuevoEstado === 'rechazada') {
        updateData.motivo_rechazo = motivoRechazo
      }

      const { error } = await supabase
        .from('reservas')
        .update(updateData)
        .eq('id', reservaId)

      if (error) throw error

      toast({
        title: "Estado actualizado",
        description: `La reserva ha sido ${nuevoEstado}`,
      })

      // Actualizar la lista de reservas
      fetchReservas()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la reserva",
        variant: "destructive",
      })
    }
  }

  // Función para manejar el rechazo con comentario
  const handleRechazarConComentario = (reservaId: string) => {
    setReservaIdParaRechazar(reservaId)
    setMotivoRechazo('')
    setDialogoRechazoAbierto(true)
  }

  // Función para confirmar el rechazo con comentario
  const confirmarRechazo = () => {
    // Validar que el comentario no esté vacío
    if (!motivoRechazo || motivoRechazo.trim() === '') {
      toast({
        title: "Error",
        description: "Por favor, ingresa un motivo para rechazar la reserva.",
        variant: "destructive",
      });
      return; // Detener si no hay comentario
    }
    
    if (reservaIdParaRechazar) {
      handleCambioEstado(reservaIdParaRechazar, 'rechazada', motivoRechazo)
      setDialogoRechazoAbierto(false)
      setReservaIdParaRechazar(null)
      setMotivoRechazo('')
    }
  }

  const filtrarReservas = (reservas: any[]) => {
    return reservas.filter(reserva => {
      const cumpleFiltroEstado = filtroEstado === 'todos' || reserva.estado === filtroEstado
      const cumpleFiltroSala = filtroSala === 'todas' || reserva.sala.id.toString() === filtroSala
      const cumpleBusqueda = 
        `${reserva.es_externo ? reserva.solicitante_nombre_completo : `${reserva.usuario.nombre} ${reserva.usuario.apellido}`} ${reserva.sala.nombre}`
          .toLowerCase()
          .includes(busquedaReserva.toLowerCase())
      
      return cumpleFiltroEstado && cumpleFiltroSala && cumpleBusqueda
    })
  }

  // Agregar un efecto para validar los horarios cuando cambien
  useEffect(() => {
    // Solo validar si tenemos todos los datos necesarios
    if (nuevaReserva.sala_id && nuevaReserva.fecha && nuevaReserva.hora_inicio && nuevaReserva.hora_fin) {
      console.log('Validando horarios en tiempo real...');
      
      // Obtener la fecha y hora actual en Chile
      const fechaHoraChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
      
      // Crear fecha seleccionada con la hora actual
      const [year, month, day] = nuevaReserva.fecha.split('-').map(Number);
      const fechaSeleccionada = new Date(year, month - 1, day);
      
      // Si es el mismo día, validar que la hora no haya pasado
      if (fechaSeleccionada.getDate() === fechaHoraChile.getDate() &&
          fechaSeleccionada.getMonth() === fechaHoraChile.getMonth() &&
          fechaSeleccionada.getFullYear() === fechaHoraChile.getFullYear()) {
        
        const [horaInicio, minutoInicio] = nuevaReserva.hora_inicio.split(':').map(Number);
        const horaInicioDate = new Date(year, month - 1, day, horaInicio, minutoInicio);
        
        if (horaInicioDate < fechaHoraChile) {
          setConflictoHorario(true);
          setMensajeConflicto('No se pueden realizar reservas en horarios pasados');
          return;
        }
      }
      
      // Validar si la fecha es pasada (días anteriores)
      fechaHoraChile.setHours(0, 0, 0, 0);
      fechaSeleccionada.setHours(0, 0, 0, 0);
      
      if (fechaSeleccionada < fechaHoraChile) {
        setConflictoHorario(true);
        setMensajeConflicto('No se pueden realizar reservas en fechas pasadas');
        return;
      }

      // Validar que la hora de fin sea posterior a la de inicio
      if (!validarHorarioConsistente(nuevaReserva.hora_inicio, nuevaReserva.hora_fin)) {
        setConflictoHorario(true);
        setMensajeConflicto('La hora de fin debe ser posterior a la hora de inicio');
        return;
      }
      
      // Si la fecha es válida y tenemos horarios ocupados, validar conflictos
      if (horariosOcupados.length > 0) {
        // Validar con la función compartida
        const resultadoValidacion = validarReserva(
          nuevaReserva.fecha,
          nuevaReserva.hora_inicio,
          nuevaReserva.hora_fin,
          horariosOcupados
        );
        
        if (!resultadoValidacion.esValida) {
          setConflictoHorario(true);
          setMensajeConflicto(resultadoValidacion.mensaje || 'Existe un conflicto con el horario seleccionado');
          return;
        }
      }

      // Si llegamos aquí, significa que no hay conflictos
      setConflictoHorario(false);
      setMensajeConflicto('');
    } else {
      // Si no tenemos todos los datos necesarios, limpiamos los estados de error
      setConflictoHorario(false);
      setMensajeConflicto('');
    }
  }, [nuevaReserva.fecha, nuevaReserva.hora_inicio, nuevaReserva.hora_fin, horariosOcupados]);

  // Optimizar la suscripción en tiempo real
  useEffect(() => {
    // Solo configurar la suscripción si estamos autenticados y tenemos las salas responsables
    // y no somos un admin sin salas (para la lista de reservas)
    if (!loadingSalasResponsable && !adminSinSalas) {
      console.log('Configurando suscripción en tiempo real para reservas...')
      
      const today = new Date().toISOString().split('T')[0]
      
      // Variables tipadas para los canales
      let reservasActualesSubscription: ReturnType<typeof supabase.channel> | undefined;
      let reservasHistoricasSubscription: ReturnType<typeof supabase.channel> | undefined;

      // Caso 1: Admin (no superadmin) con salas asignadas
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        console.log('Configurando suscripción filtrada para admin con salas responsables');
        const salaIds = salasResponsable.map(sala => sala.id)
        const salaIdsString = salaIds.join(',')
        
        // Suscribirse a las reservas actuales de las salas responsables
        reservasActualesSubscription = supabase
          .channel('reservas-actuales-filtradas')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'reservas',
              filter: `sala_id=in.(${salaIdsString})`,
            },
            (payload) => {
              console.log('Cambio en reservas actuales detectado:', payload)
              
              // Recargar solo la lista relevante según el tipo de cambio
              if (payload.eventType === 'INSERT' || 
                  (payload.eventType === 'UPDATE' && payload.new?.fecha >= today) ||
                  (payload.eventType === 'DELETE' && payload.old?.fecha >= today)) {
                fetchReservas()
              }
            }
          )
          .subscribe()
        
        // Suscribirse a las reservas históricas solo si está activa la vista de históricas
        if (mostrarHistoricas) {
          reservasHistoricasSubscription = supabase
            .channel('reservas-historicas-filtradas')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'reservas',
                filter: `sala_id=in.(${salaIdsString})`,
              },
              (payload) => {
                console.log('Cambio en reservas históricas detectado:', payload)
                
                // Recargar solo la lista relevante según el tipo de cambio
                if ((payload.eventType === 'UPDATE' && payload.new?.fecha < today) ||
                    (payload.eventType === 'DELETE' && payload.old?.fecha < today)) {
                  fetchReservas()
                }
              }
            )
            .subscribe()
        }
      } 
      // Caso 2: Superadmin o usuarios normales - reciben actualizaciones de todas las reservas
      else {
        console.log(esSuperAdmin ? 'Configurando suscripción para superadmin (todas las reservas)' : 'Configurando suscripción para usuario regular');
        
        // Suscribirse a todas las reservas, pero optimizando las consultas
        reservasActualesSubscription = supabase
          .channel('reservas-actuales')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reservas' },
            (payload) => {
              console.log('Cambio en reservas actuales detectado:', payload)
              
              // Recargar solo si es una inserción o si la fecha es relevante
              if (payload.eventType === 'INSERT' || 
                  (payload.eventType === 'UPDATE' && payload.new?.fecha >= today) ||
                  (payload.eventType === 'DELETE' && payload.old?.fecha >= today)) {
                fetchReservas()
              }
            }
          )
          .subscribe()
        
        // Suscribirse a las reservas históricas solo si está activa la vista de históricas
        if (mostrarHistoricas) {
          reservasHistoricasSubscription = supabase
            .channel('reservas-historicas')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'reservas' },
              (payload) => {
                console.log('Cambio en reservas históricas detectado:', payload)
                
                // Recargar solo si la fecha es relevante para históricas
                if ((payload.eventType === 'UPDATE' && payload.new?.fecha < today) ||
                    (payload.eventType === 'DELETE' && payload.old?.fecha < today)) {
                  fetchReservas()
                }
              }
            )
            .subscribe()
        }
      }

      // Limpiar las suscripciones al desmontar
      return () => {
        console.log('Limpiando suscripciones de reservas')
        if (reservasActualesSubscription) {
          supabase.removeChannel(reservasActualesSubscription)
        }
        if (reservasHistoricasSubscription) {
          supabase.removeChannel(reservasHistoricasSubscription)
        }
      }
    }
  }, [loadingSalasResponsable, salasResponsable, esAdmin, esSuperAdmin, mostrarHistoricas, adminSinSalas])

  // Mostrar spinner de carga solo durante la inicialización
  if (loadingSalasResponsable || !initialized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Nueva Reserva</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={nuevaReserva.es_externo}
                onCheckedChange={(checked) => setNuevaReserva(prev => ({ ...prev, es_externo: checked }))}
              />
              <Label>Reserva Externa</Label>
            </div>

            {!nuevaReserva.es_externo ? (
              <div>
                <Label>Usuario</Label>
                <UserSelect
                  users={usuarios}
                  value={nuevaReserva.usuario_id}
                  onValueChange={(value) => setNuevaReserva(prev => ({ ...prev, usuario_id: value }))}
                  isLoading={loading && usuarios.length === 0}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Nombre Completo</Label>
                  <Input
                    value={nuevaReserva.solicitante_nombre_completo || ''}
                    onChange={(e) => setNuevaReserva(prev => ({ 
                      ...prev, 
                      solicitante_nombre_completo: e.target.value 
                    }))}
                    required
                  />
                </div>
                <div>
                  <Label>Institución</Label>
                  <Input
                    value={nuevaReserva.institucion || ''}
                    onChange={(e) => setNuevaReserva(prev => ({ 
                      ...prev, 
                      institucion: e.target.value 
                    }))}
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={nuevaReserva.mail_externos || ''}
                    onChange={(e) => setNuevaReserva(prev => ({ 
                      ...prev, 
                      mail_externos: e.target.value 
                    }))}
                    required
                  />
                </div>
                <div>
                  <Label>Teléfono (opcional)</Label>
                  <Input
                    value={nuevaReserva.telefono || ''}
                    onChange={(e) => setNuevaReserva(prev => ({ 
                      ...prev, 
                      telefono: e.target.value 
                    }))}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="comentario">Comentario <span className="text-red-500">*</span></Label>
              <Textarea
                id="comentario"
                name="comentario"
                placeholder="Indica el motivo o detalles de la reserva"
                value={nuevaReserva.comentario}
                onChange={(e) => setNuevaReserva(prev => ({ 
                  ...prev, 
                  comentario: e.target.value 
                }))}
                className="resize-none"
              />
            </div>

            <div className="space-y-4">
              <div>
                <Label>Sala</Label>
                {loading && salasLocales.length === 0 ? (
                  <div className="flex items-center h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span className="text-muted-foreground">Cargando salas...</span>
                  </div>
                ) : (
                  <Select 
                    onValueChange={(value) => {
                      console.log('Sala seleccionada:', value) // Debug
                      setNuevaReserva(prev => ({ ...prev, sala_id: value }))
                      setSelectedSala(value)
                      
                      // Si ya tenemos fecha, consultar horarios ocupados
                      if (nuevaReserva.fecha) {
                        // Usar el formato YYYY-MM-DD directamente del input
                        // No formatear nuevamente para evitar problemas de zona horaria
                        fetchOcupados(Number(value), nuevaReserva.fecha, 'cambioSala');
                      }
                    }}
                    value={nuevaReserva.sala_id}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una sala" />
                    </SelectTrigger>
                    <SelectContent>
                      {salasLocales.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No hay salas disponibles
                        </div>
                      ) : (
                        salasLocales.map((sala) => (
                          <SelectItem key={sala.id} value={sala.id.toString()}>
                            {sala.nombre}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>Fecha</Label>
                <Input
                  id="fecha"
                  name="fecha"
                  type="date"
                  value={nuevaReserva.fecha}
                  onChange={(e) => {
                    console.log('Fecha seleccionada:', e.target.value) // Debug
                    const newDate = e.target.value;
                    
                    // Actualizar el estado local
                    setNuevaReserva(prev => ({ ...prev, fecha: newDate }));
                    
                    // Solo establecer selectedDate si tenemos una fecha válida
                    if (newDate) {
                      // Parsear la fecha como fecha local, no UTC
                      // Esto es crucial para evitar problemas de zona horaria
                      const [year, month, day] = newDate.split('-').map(Number);
                      const parsedDate = new Date(year, month - 1, day);
                      
                      // Asegurarse de que la fecha sea válida antes de usarla
                      if (!isNaN(parsedDate.getTime())) {
                        setSelectedDate(parsedDate);
                        
                        // Si tenemos sala, consultar horarios
                        if (nuevaReserva.sala_id) {
                          // Usar el formato YYYY-MM-DD directamente del input
                          // No formatear nuevamente para evitar problemas de zona horaria
                          fetchOcupados(Number(nuevaReserva.sala_id), newDate, 'cambioFecha');
                        }
                      }
                    } else {
                      // Si no hay fecha, limpiar selectedDate
                      setSelectedDate(null);
                    }
                  }}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Mostrar horarios ocupados inmediatamente después de los campos de sala y fecha */}
              {selectedSala && selectedDate && (
                <div className="rounded-lg border border-border p-4 bg-background">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <Label className="font-medium">Horarios Ocupados</Label>
                  </div>
                  {horariosOcupados.length > 0 ? (
                    <ul className="space-y-2">
                      {horariosOcupados.map((horario, index) => (
                        <li 
                          key={index} 
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-100 text-red-700"
                        >
                          <div className="flex-1">
                            <span className="font-medium">{formatHora(horario.hora_inicio)}</span>
                            <span className="mx-2">-</span>
                            <span className="font-medium">{formatHora(horario.hora_fin)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay horarios ocupados para esta fecha
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hora de Inicio</Label>
                  <Input
                    type="time"
                    value={nuevaReserva.hora_inicio}
                    onChange={(e) => setNuevaReserva(prev => ({ 
                      ...prev, 
                      hora_inicio: e.target.value 
                    }))}
                    required
                    className={conflictoHorario ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                </div>
                <div>
                  <Label>Hora de Fin</Label>
                  <Input
                    type="time"
                    value={nuevaReserva.hora_fin}
                    onChange={(e) => setNuevaReserva(prev => ({ 
                      ...prev, 
                      hora_fin: e.target.value 
                    }))}
                    required
                    className={conflictoHorario ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                </div>
              </div>

              {/* Mostrar mensaje de error si hay conflicto */}
              {conflictoHorario && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error de horario</AlertTitle>
                  <AlertDescription>
                    {mensajeConflicto}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={nuevaReserva.es_urgente}
                  onCheckedChange={(checked) => setNuevaReserva(prev => ({ 
                    ...prev, 
                    es_urgente: checked as boolean 
                  }))}
                />
                <Label>Reserva Urgente</Label>
              </div>
            </div>

            <Button type="submit">Crear Reserva</Button>
          </form>
        </CardContent>
      </Card>

      {/* Alerta de éxito */}
      {mostrarAlertaExito && (
        <Alert className="mb-6 bg-green-50 border-green-500 text-green-700">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-700 font-semibold">Reserva Exitosa</AlertTitle>
          <AlertDescription className="text-green-700">
            {mensajeExito}
          </AlertDescription>
        </Alert>
      )}

      {esAdmin && !esSuperAdmin && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Acceso limitado</AlertTitle>
          <AlertDescription>
            {salasResponsable.length > 0 
              ? `Solo puedes gestionar reservas de las salas de las que eres responsable (${salasResponsable.length} salas).`
              : "No tienes salas asignadas, por lo que no puedes gestionar reservas."}
          </AlertDescription>
        </Alert>
      )}

      {/* Mostrar información para superadmins */}
      {esSuperAdmin && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Acceso de Superadministrador</AlertTitle>
          <AlertDescription>
            Como superadministrador, puedes ver y gestionar todas las reservas del sistema.
          </AlertDescription>
        </Alert>
      )}

      {/* Incluir aquí el listado de reservas solo si no es admin sin salas o si es superadmin */}
      {(!adminSinSalas || esSuperAdmin) && (
        <div className="mt-8">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Reservas</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={mostrarReservasSistema}
                    onCheckedChange={setMostrarReservasSistema}
                  />
                  <Label>Mostrar reservas del sistema</Label>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setMostrarHistoricas(!mostrarHistoricas)}
                >
                  {mostrarHistoricas ? 'Ver Actuales' : 'Ver Históricas'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Buscar</Label>
                <Input
                  placeholder="Buscar por usuario o sala..."
                  value={busquedaReserva}
                  onChange={(e) => setBusquedaReserva(e.target.value)}
                />
              </div>
              <div>
                <Label>Filtrar por estado</Label>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="aprobada">Aprobada</SelectItem>
                    <SelectItem value="rechazada">Rechazada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Filtrar por sala</Label>
                <Select value={filtroSala} onValueChange={setFiltroSala}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {salasLocales.map((sala) => (
                      <SelectItem key={sala.id} value={sala.id.toString()}>
                        {sala.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-2 mt-6">
            {/* Encabezado de la lista */}
            <div className="hidden md:flex items-center px-3 py-2 bg-muted text-sm font-medium text-muted-foreground rounded-md">
              <div className="flex-1 px-3">Solicitante</div>
              <div className="w-48 px-3">Sala</div>
              <div className="w-48 px-3">Fecha y Hora</div>
              <div className="w-48 px-3">Comentario</div>
              <div className="w-28 px-3">Estado</div>
              <div className="w-[88px] px-3 text-center">Acciones</div>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filtrarReservas(mostrarHistoricas ? reservasHistoricas : reservas).length > 0 ? (
              filtrarReservas(mostrarHistoricas ? reservasHistoricas : reservas).map((reserva) => (
                <Card key={reserva.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Vista para escritorio */}
                    <div className="hidden md:flex items-center border-l-4 pl-0" 
                      style={{ 
                        borderColor: reserva.estado === 'pendiente' ? '#F59E0B' : 
                                   reserva.estado === 'aprobada' ? '#10B981' : 
                                   reserva.estado === 'rechazada' ? '#EF4444' : '#6B7280' 
                      }}
                    >
                      {/* Información del solicitante */}
                      <div className="flex-1 p-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">
                            {reserva.es_externo 
                              ? reserva.solicitante_nombre_completo 
                              : `${reserva.usuario.nombre} ${reserva.usuario.apellido}`}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {reserva.es_externo ? reserva.institucion : reserva.usuario.rol}
                          </span>
                          {reserva.es_urgente && (
                            <span className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5 inline-flex items-center">
                              Urgente
                            </span>
                          )}
                        </div>
                        {reserva.comentario && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{reserva.comentario}</p>
                        )}
                      </div>

                      {/* Información de la sala */}
                      <div className="w-48 p-3 border-l border-border">
                        <p className="font-medium text-sm">{reserva.sala.nombre}</p>
                      </div>

                      {/* Fecha y hora */}
                      <div className="w-48 p-3 border-l border-border">
                        <p className="text-sm">{(() => {
                          // Usar directamente la fecha correcta de la base de datos
                          const partesFecha = reserva.fecha.split('-');
                          // Crear fecha en hora local para evitar desplazamientos de zona horaria
                          const fecha = new Date(
                            parseInt(partesFecha[0]), // año
                            parseInt(partesFecha[1]) - 1, // mes (0-indexado)
                            parseInt(partesFecha[2]) // día
                          );
                          return fecha.toLocaleDateString();
                        })()}</p>
                        <p className="text-xs text-muted-foreground">
                          {reserva.hora_inicio.slice(0, 5)} - {reserva.hora_fin.slice(0, 5)}
                        </p>
                      </div>

                      {/* Comentario */}
                      <div className="w-48 p-3 border-l border-border">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {reserva.comentario || "-"}
                        </p>
                      </div>

                      {/* Estado */}
                      <div className="w-28 p-3 border-l border-border">
                        <span className={`text-xs rounded-full px-2 py-0.5 inline-flex items-center ${
                          reserva.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          reserva.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                          reserva.estado === 'rechazada' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {reserva.estado.charAt(0).toUpperCase() + reserva.estado.slice(1)}
                        </span>
                      </div>

                      {/* Acciones */}
                      <div className="w-[88px] p-3 border-l border-border">
                        {reserva.estado === 'pendiente' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleCambioEstado(reserva.id, 'aprobada')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRechazarConComentario(reserva.id)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                              </svg>
                            </Button>
                          </div>
                        ) : (
                          // Espacio vacío para mantener la alineación cuando no hay acciones
                          <div className="w-full h-8 flex items-center justify-center">
                            <span className="text-muted-foreground/30">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vista para móviles */}
                    <div className="md:hidden border-l-4 pl-0" 
                      style={{ 
                        borderColor: reserva.estado === 'pendiente' ? '#F59E0B' : 
                                   reserva.estado === 'aprobada' ? '#10B981' : 
                                   reserva.estado === 'rechazada' ? '#EF4444' : '#6B7280' 
                      }}
                    >
                      <div className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-sm">
                              {reserva.es_externo 
                                ? reserva.solicitante_nombre_completo 
                                : `${reserva.usuario.nombre} ${reserva.usuario.apellido}`}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {reserva.es_externo ? reserva.institucion : reserva.usuario.rol}
                            </span>
                          </div>
                          <span className={`text-xs rounded-full px-2 py-0.5 inline-flex items-center ${
                            reserva.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            reserva.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                            reserva.estado === 'rechazada' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {reserva.estado.charAt(0).toUpperCase() + reserva.estado.slice(1)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div>
                            <p className="font-medium text-sm">{reserva.sala.nombre}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{(() => {
                              // Usar directamente la fecha correcta de la base de datos
                              const partesFecha = reserva.fecha.split('-');
                              // Crear fecha en hora local para evitar desplazamientos de zona horaria
                              const fecha = new Date(
                                parseInt(partesFecha[0]), // año
                                parseInt(partesFecha[1]) - 1, // mes (0-indexado)
                                parseInt(partesFecha[2]) // día
                              );
                              return fecha.toLocaleDateString();
                            })()}</p>
                            <p className="text-xs text-muted-foreground">
                              {reserva.hora_inicio.slice(0, 5)} - {reserva.hora_fin.slice(0, 5)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {reserva.es_urgente && (
                            <span className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5 inline-flex items-center">
                              Urgente
                            </span>
                          )}
                          
                          {reserva.comentario && (
                            <div className="mt-2 p-2 bg-gray-50 rounded-md">
                              <div className="text-xs font-medium text-gray-600">Comentario:</div>
                              <p className="text-xs text-muted-foreground">{reserva.comentario}</p>
                            </div>
                          )}
                          
                          {reserva.estado === 'pendiente' ? (
                            <div className="flex gap-2 ml-auto">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleCambioEstado(reserva.id, 'aprobada')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRechazarConComentario(reserva.id)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                              </Button>
                            </div>
                          ) : (
                            // Espacio vacío para mantener la alineación cuando no hay acciones
                            <div className="ml-auto flex items-center">
                              <span className="text-muted-foreground/30">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                </svg>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-muted">
                <p className="text-muted-foreground">No se encontraron reservas con los filtros seleccionados.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensaje especializado para admins sin salas asignadas (excepto superadmins) */}
      {adminSinSalas && !esSuperAdmin && (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="bg-orange-100 p-3 rounded-full">
                <Info className="h-8 w-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-semibold">No puedes gestionar reservas</h2>
              <p className="text-muted-foreground max-w-md">
                Aunque puedes crear reservas en cualquier sala disponible, no tienes salas asignadas 
                para gestionar las reservas existentes. Contacta al administrador del sistema para 
                que te asigne salas si necesitas esta funcionalidad.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo para rechazar con comentario */}
      <Dialog open={dialogoRechazoAbierto} onOpenChange={setDialogoRechazoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Reserva</DialogTitle>
            <DialogDescription>
              Por favor, proporciona un motivo para el rechazo de esta reserva.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo del rechazo"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoRechazoAbierto(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmarRechazo}
              disabled={!motivoRechazo || motivoRechazo.trim() === ''} // Deshabilitar si no hay comentario
            >
              Rechazar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}