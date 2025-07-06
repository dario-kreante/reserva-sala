'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useReservasData } from '@/hooks/useReservasData'
import { useUsuariosData } from '@/hooks/useUsuariosData'
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import esLocale from '@fullcalendar/core/locales/es'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'
import { 
  Users, CalendarCheck2, Clock, TrendingUp,
  BarChart3, PieChart as PieChartIcon, Download, Plus, X,
  User, Building, Calendar, MessageSquare, Tag, BookOpen, GraduationCap, FileText, Info, AlertTriangle
} from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'
import Link from "next/link"
import { esFechaValida, validarHorarioConsistente } from "./utils/horarioValidation"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/useUser"
import { useResponsableSalas } from '@/hooks/useResponsableSalas'
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Función para calcular la duración en horas entre dos horas
const calcularDuracion = (horaInicio: string, horaFin: string): number => {
  const inicio = new Date(`2000-01-01T${horaInicio}`)
  const fin = new Date(`2000-01-01T${horaFin}`)
  return (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)
}

interface DashboardStats {
  totalUsuarios: number
  usuariosActivos: number
  reservasHoy: number
  reservasPendientes: number
  reservasPorDia: Array<{ fecha: string; total: number }>
  distribucionRoles: Array<{ name: string; value: number }>
  usoPorSala: Array<{ name: string; value: number }>
  tasaUsoSalas: Array<{ name: string; horas: number; porcentaje: number }>
  usoPorSolicitante: Array<{ name: string; value: number; count: number }>
}

export default function Home() {
  const router = useRouter()
  const [reservas, setReservas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [salas, setSalas] = useState<any[]>([])
  // Ya no necesitamos estados locales de loading - usamos directamente los hooks
  const [stats, setStats] = useState<DashboardStats>({
    totalUsuarios: 0,
    usuariosActivos: 0,
    reservasHoy: 0,
    reservasPendientes: 0,
    reservasPorDia: [],
    distribucionRoles: [],
    usoPorSala: [],
    tasaUsoSalas: [],
    usoPorSolicitante: []
  })
  const [salaSeleccionada, setSalaSeleccionada] = useState('todas')
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('semana')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [usuarioFiltro, setUsuarioFiltro] = useState('todos')
  const [mostrarAccionesRapidas, setMostrarAccionesRapidas] = useState(true)
  const [calendarView, setCalendarView] = useState('timeGridWeek')
  const calendarRef = useRef<any>(null)
  const { reservas: reservasData, loading: loadingReservasData, fetchReservas, salas: salasData } = useReservasData()
  const { usuarios: usuariosData, loading: loadingUsuariosData } = useUsuariosData()
  const [reservaSeleccionada, setReservaSeleccionada] = useState<any>(null)
  const [detalleAbierto, setDetalleAbierto] = useState(false)
  
  // Agregar estados para el diálogo de rechazo
  const [dialogoRechazoAbierto, setDialogoRechazoAbierto] = useState(false)
  const [comentarioRechazo, setComentarioRechazo] = useState('')
  
  // Estado para timeout de loading
  const [forceShowContent, setForceShowContent] = useState(false)
  
  // Estado para controlar la redirección
  const [redirecting, setRedirecting] = useState(false)

  // Agregar hook de usuario para debug y autenticación
  const { user, loading: userLoading } = useUser()

  const { 
    salasResponsable, 
    loading: loadingSalasResponsable, 
    puedeVerTodo,
    esSuperAdmin,
    esAdmin
  } = useResponsableSalas()

  // Usuario autenticado
  useEffect(() => {
    if (user) {
      console.log('✅ Usuario autenticado:', user.nombre, user.apellido, `(${user.rol})`)
    }
  }, [user])

  // VALIDACIÓN DE ROLES: Redirección para usuarios no administradores
  useEffect(() => {
    if (!userLoading && user && !redirecting) {
      const rolesPermitidos = ['admin', 'superadmin'];
      
      if (!rolesPermitidos.includes(user.rol)) {
        console.log('🚫 Acceso denegado al dashboard. Usuario:', user.nombre, user.apellido, `(${user.rol}) - Redirigiendo a /mis-reservas`);
        setRedirecting(true);
        router.push('/mis-reservas');
      } else {
        console.log('✅ Acceso autorizado al dashboard. Usuario:', user.nombre, user.apellido, `(${user.rol})`);
      }
    }
  }, [user, userLoading, router, redirecting])

  // useEffect para timeout de loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout alcanzado en página principal - forzando mostrar contenido')
      setForceShowContent(true)
    }, 8000)

    if (!loadingReservasData && !loadingSalasResponsable && !loadingUsuariosData) {
      clearTimeout(timeout)
    }

    return () => clearTimeout(timeout)
  }, [loadingReservasData, loadingSalasResponsable, loadingUsuariosData])

  // La protección de autenticación se mueve más abajo después de todas las funciones

  useEffect(() => {
    if (!loadingReservasData && reservasData) {
      setReservas(reservasData)
    }
    if (!loadingUsuariosData && usuariosData) {
      setUsuarios(usuariosData)
    }
    if (salasData && salasData.length > 0) {
      // CORRECCIÓN: Filtrar salas según el rol del usuario
      let salasFiltradas = salasData;
      
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        // Si es admin (no superadmin), filtrar solo las salas de las que es responsable
        const salaIds = salasResponsable.map(sala => sala.id);
        salasFiltradas = salasData.filter(sala => salaIds.includes(sala.id));
        console.log('🔐 Admin filtrado - Salas visibles:', salasFiltradas.map(s => s.nombre));
      } else if (esSuperAdmin) {
        console.log('👑 Superadmin - Todas las salas visibles:', salasData.length);
      }
      
      setSalas(salasFiltradas)
    }
  }, [loadingReservasData, loadingUsuariosData, reservasData, usuariosData, salasData, esAdmin, esSuperAdmin, salasResponsable])

  useEffect(() => {
    if (!loadingReservasData && !loadingUsuariosData) {
      // Calcular fecha de hoy en formato YYYY-MM-DD para comparación
      const hoy = new Date().toISOString().split('T')[0];
      console.log(`Fecha de hoy para estadísticas: ${hoy}`);
      
      // CORRECCIÓN: Usar reservas filtradas según responsabilidad para todas las estadísticas
      let reservasParaEstadisticas = reservas;
      
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        const salaIds = salasResponsable.map(sala => sala.id);
        reservasParaEstadisticas = reservas.filter(reserva => 
          reserva.sala && salaIds.includes(reserva.sala.id)
        );
        console.log('📊 Estadísticas filtradas para admin:', reservasParaEstadisticas.length, 'de', reservas.length, 'reservas');
      }
      
      // Contar reservas pendientes (usando reservas filtradas)
      const pendientes = reservasParaEstadisticas.filter(r => r.estado === 'pendiente').length;
      
      // Contar reservas de hoy - normalizar el formato de fecha de cada reserva para comparar (usando reservas filtradas)
      const reservasHoy = reservasParaEstadisticas.filter(r => {
        // Normalizar la fecha de la reserva al formato YYYY-MM-DD
        let fechaNormalizada: string;
        
        if (r.fecha.includes('/')) {
          // Si viene en formato DD/MM/YYYY
          const partes = r.fecha.split('/');
          if (partes.length === 3) {
            fechaNormalizada = `${partes[2]}-${partes[1]}-${partes[0]}`;
          } else {
            console.error(`Formato de fecha incorrecto en reserva ${r.id}: ${r.fecha}`);
            return false; // Excluir esta reserva si el formato es incorrecto
          }
        } else {
          try {
            // Si ya viene en formato YYYY-MM-DD o similar
            const fechaObj = new Date(r.fecha);
            // Verificar que la fecha sea válida
            if (isNaN(fechaObj.getTime())) {
              console.error(`Fecha inválida en reserva ${r.id}: ${r.fecha}`);
              return false; // Excluir esta reserva si la fecha es inválida
            }
            fechaNormalizada = fechaObj.toISOString().split('T')[0];
          } catch (error) {
            console.error(`Error al procesar la fecha de reserva ${r.id}:`, error);
            return false; // Excluir esta reserva si hay error al procesar
          }
        }
        
        // Comparar la fecha normalizada con hoy
        return fechaNormalizada === hoy;
      }).length;
      
      // Calcular usuarios con reservas (usuarios que han realizado al menos una reserva en el período) (usando reservas filtradas)
      const usuariosActivos = new Set(reservasParaEstadisticas.filter(r => r.usuario?.id).map(r => r.usuario!.id)).size;
      
      // Distribución de roles (mantenemos todos los usuarios para esta estadística)
      const roles = usuarios.reduce<Record<string, number>>((acc, user) => {
        acc[user.rol] = (acc[user.rol] || 0) + 1
        return acc
      }, {})

      // Uso por sala (usando reservas filtradas)
      const usoPorSala = reservasParaEstadisticas.reduce<Record<string, number>>((acc, reserva) => {
        const nombreSala = reserva.sala?.nombre || 'Sin Sala'
        acc[nombreSala] = (acc[nombreSala] || 0) + 1
        return acc
      }, {})

      // Reservas por día (usando reservas filtradas)
      const ultimos7Dias = [...Array(7)].map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
      }).reverse()

      const reservasPorDia: { [key: string]: number } = {};
      
      // Determinar el rango de fechas según el período seleccionado
      const hoyDate = new Date();
      let startDate: Date;
      
      if (periodoSeleccionado === 'semana') {
        startDate = new Date(hoyDate);
        startDate.setDate(hoyDate.getDate() - 6);
      } else if (periodoSeleccionado === 'mes') {
        startDate = new Date(hoyDate);
        startDate.setDate(hoyDate.getDate() - 29);
      } else { // año
        startDate = new Date(hoyDate);
        startDate.setDate(hoyDate.getDate() - 364);
      }
      
      // Inicializar todas las fechas en el rango con cero reservas
      let currentDate = new Date(startDate);
      while (currentDate <= hoyDate) {
        const fechaKey = currentDate.toISOString().split('T')[0];
        reservasPorDia[fechaKey] = 0;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Contar reservas por día (usando reservas filtradas)
      reservasParaEstadisticas.forEach(reserva => {
        try {
          // Normalizar la fecha de la reserva
          let fechaNormalizada: string;
          
          if (reserva.fecha.includes('/')) {
            // Si viene en formato DD/MM/YYYY
            const partes = reserva.fecha.split('/');
            if (partes.length === 3) {
              fechaNormalizada = `${partes[2]}-${partes[1]}-${partes[0]}`;
            } else {
              return; // Saltarse esta reserva
            }
          } else {
            // Si ya viene en otro formato
            const fechaObj = new Date(reserva.fecha);
            if (isNaN(fechaObj.getTime())) {
              return; // Saltarse esta reserva
            }
            fechaNormalizada = fechaObj.toISOString().split('T')[0];
          }
          
          // Solo contar si está dentro del rango de fechas
          const reservaDate = new Date(fechaNormalizada);
          if (reservaDate >= startDate && reservaDate <= hoyDate) {
            if (reservasPorDia[fechaNormalizada] !== undefined) {
              reservasPorDia[fechaNormalizada]++;
            }
          }
        } catch (error) {
          console.error('Error al procesar fecha para estadísticas:', error);
        }
      });
      
      // Calcular horas por sala para tasa de uso (usando reservas filtradas)
      const horasPorSala: Record<string, number> = {}
      salas.forEach(sala => {
        const reservasSala = reservasParaEstadisticas.filter(r => r.sala?.id === sala.id)
        const horas = reservasSala.reduce((total, r) => {
          return total + calcularDuracion(r.hora_inicio, r.hora_fin)
        }, 0)
        
        if (horas > 0) {
          horasPorSala[sala.nombre] = horas
        }
      })

      // Convertir a array y calcular porcentajes (usando salas filtradas)
      const totalHoras = Object.values(horasPorSala).reduce((sum, horas) => sum + horas, 0)
      const tasaUsoSalasData = Object.entries(horasPorSala)
        .map(([nombre, horas]) => ({
          name: nombre,
          horas: Number(horas.toFixed(2)),
          porcentaje: Number(((horas / totalHoras) * 100).toFixed(1))
        }))
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10) // Mostrar solo las 10 salas más usadas (de las que tiene acceso el admin)

      // Uso por tipo de solicitante (usando reservas filtradas)
      const usoPorSolicitante = reservasParaEstadisticas.reduce<Record<string, { value: number; count: number }>>((acc, reserva) => {
        let tipo: string
        if (reserva.es_externo) {
          tipo = 'Externos'
        } else if (reserva.es_reserva_sistema) {
          tipo = 'Sistema'
        } else {
          tipo = reserva.usuario?.rol === 'profesor' ? 'Profesores' : 
                reserva.usuario?.rol === 'alumno' ? 'Alumnos' :
                reserva.usuario?.rol === 'administrativo' ? 'Administrativos' : 'Otros'
        }
        
        const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
        
        if (!acc[tipo]) {
          acc[tipo] = { value: 0, count: 0 }
        }
        acc[tipo].value += duracion
        acc[tipo].count += 1
        return acc
      }, {})

      setStats({
        totalUsuarios: usuarios.length,
        usuariosActivos,
        reservasHoy,
        reservasPendientes: pendientes,
        reservasPorDia: Object.entries(reservasPorDia).map(([fecha, total]) => ({ fecha, total })),
        distribucionRoles: Object.entries(roles).map(([name, value]) => ({ name, value })),
        usoPorSala: Object.entries(usoPorSala).map(([name, value]) => ({ name, value })),
        tasaUsoSalas: tasaUsoSalasData,
        usoPorSolicitante: Object.entries(usoPorSolicitante).map(([name, data]) => ({
          name,
          value: data.value,
          count: data.count
        }))
      })
    }
  }, [loadingReservasData, loadingUsuariosData, reservas, usuarios, salas, periodoSeleccionado, esAdmin, esSuperAdmin, salasResponsable])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

  // Función para obtener el color del evento según el estado
  const getColorPorEstado = (estado: string, esReservaSistema: boolean) => {
    // Si es una reserva del sistema, usar un color distintivo
    if (esReservaSistema) {
      return '#8B5CF6'; // violeta/púrpura
    }

    // Si no es del sistema, usar los colores normales según el estado
    switch (estado) {
      case 'aprobada':
        return '#22c55e'; // verde
      case 'pendiente':
        return '#f59e0b'; // amarillo
      case 'rechazada':
        return '#ef4444'; // rojo
      case 'cancelada':
        return '#6b7280'; // gris
      case 'vencida':
        return '#d97706'; // naranja/marrón para vencidas
      default:
        return '#3b82f6'; // azul por defecto
    }
  };

  // Función para manejar clics en fechas del calendario
  const handleDateClick = (info: { date: Date }) => {
    const fechaSeleccionada = info.date;
    
    // Validar que la fecha no sea en el pasado usando la función importada
    const fechaFormateada = fechaSeleccionada.toISOString().split('T')[0];
    
    if (!esFechaValida(fechaFormateada)) {
      toast({
        title: "Fecha inválida",
        description: "No se pueden crear reservas en fechas pasadas",
        variant: "destructive",
      });
      return;
    }
    
    console.log(`Fecha seleccionada en calendario: ${fechaFormateada}`);
    
    // Aquí se podría implementar lógica adicional como abrir un modal o redirigir
    // a la página de reservas con la fecha preseleccionada
  };

  const obtenerEventosCalendario = () => {
    // Filtrar reservas según criterios seleccionados
    const reservasFiltradas = reservas.filter(r => {
      // Filtrar por sala si se ha seleccionado una específica
      if (salaSeleccionada !== 'todas' && r.sala?.id.toString() !== salaSeleccionada) {
        return false;
      }
      
      // Filtrar por estado si se ha seleccionado uno específico
      if (estadoFiltro !== 'todos' && r.estado !== estadoFiltro) {
        return false;
      }
      
      // Filtrar por usuario si se ha seleccionado uno específico
      if (usuarioFiltro !== 'todos' && r.usuario?.id !== usuarioFiltro) {
        return false;
      }
      
      // IMPORTANTE: Aquí no filtramos las reservas canceladas porque queremos mostrarlas
      // en el calendario para tener un registro visual, pero en las validaciones de conflictos
      // las reservas canceladas se ignoran

      return true;
    });
    
    // Log para depuración
    console.log(`📅 Calendario - Total reservas en estado: ${reservas.length}`);
    console.log(`📅 Calendario - Total reservas filtradas: ${reservasFiltradas.length}`);
    console.log(`📅 Calendario - Filtros aplicados: sala=${salaSeleccionada}, estado=${estadoFiltro}, usuario=${usuarioFiltro}`);
    console.log(`📅 Calendario - Estados de reservas:`, reservas.reduce((acc, r) => {
      acc[r.estado] = (acc[r.estado] || 0) + 1;
      return acc;
    }, {}));
    console.log(`📅 Calendario - Fechas de reservas (muestra):`, reservas.slice(0, 5).map(r => r.fecha));
    
    const eventos = reservasFiltradas.map(reserva => {
      // Normalizar el formato de fecha para asegurar consistencia
      let fechaEvento: string;
      
      if (reserva.fecha.includes('/')) {
        // Si la fecha viene en formato DD/MM/YYYY
        const partes = reserva.fecha.split('/');
        if (partes.length === 3) {
          fechaEvento = `${partes[2]}-${partes[1]}-${partes[0]}`;
        } else {
          console.error(`Formato de fecha incorrecto en reserva ${reserva.id}: ${reserva.fecha}`);
          fechaEvento = reserva.fecha;
        }
      } else {
        try {
          // Si ya viene en formato YYYY-MM-DD o similar
          const fechaObj = new Date(reserva.fecha);
          
          // Verificar que la fecha sea válida
          if (isNaN(fechaObj.getTime())) {
            console.error(`Fecha inválida en reserva ${reserva.id}: ${reserva.fecha}`);
            fechaEvento = reserva.fecha;
          } else {
            fechaEvento = fechaObj.toISOString().split('T')[0];
          }
        } catch (error) {
          console.error(`Error al procesar la fecha de reserva ${reserva.id}:`, error);
          fechaEvento = reserva.fecha;
        }
      }
      
      // Verificar el formato final de la fecha
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEvento)) {
        console.warn(`La fecha para la reserva ${reserva.id} sigue siendo incorrecta: ${fechaEvento}`);
      } else {
        console.log(`Fecha para reserva ${reserva.id} normalizada: ${fechaEvento} (original: ${reserva.fecha})`);
      }
      
      // Horarios normalizados
      const horaInicio = reserva.hora_inicio || '00:00:00';
      const horaFin = reserva.hora_fin || '00:00:00';
      
      // Obtener color según el estado
      const color = getColorPorEstado(reserva.estado, reserva.es_reserva_sistema);
      
      // Crear el evento para el calendario con título descriptivo
      let titulo: string;
      if (reserva.es_reserva_sistema) {
        // Para reservas del sistema, usar información académica
        if (reserva.nombre_modulo || reserva.profesor_responsable) {
          const partes = [];
          if (reserva.nombre_modulo) partes.push(reserva.nombre_modulo);
          if (reserva.profesor_responsable) partes.push(reserva.profesor_responsable);
          titulo = partes.join(' - ');
        } else {
          titulo = 'Reserva del Sistema';
        }
      } else if (reserva.es_externo) {
        titulo = reserva.solicitante_nombre_completo || 'Externo';
      } else {
        titulo = reserva.usuario?.nombre ? `${reserva.usuario.nombre} ${reserva.usuario.apellido || ''}` : 'Usuario';
      }

      return {
        id: reserva.id.toString(),
        title: titulo,
        start: `${fechaEvento}T${horaInicio}`,
        end: `${fechaEvento}T${horaFin}`,
        backgroundColor: color,
        borderColor: color,
        textColor: '#ffffff',
        extendedProps: {
          sala: reserva.sala?.nombre || 'Sin sala',
          estado: reserva.estado,
          esUrgente: reserva.es_urgente,
          esExterno: reserva.es_externo,
          esReservaSistema: reserva.es_reserva_sistema,
          solicitante: reserva.es_externo 
            ? reserva.solicitante_nombre_completo 
            : (reserva.usuario?.nombre ? `${reserva.usuario.nombre} ${reserva.usuario.apellido || ''}` : 'Usuario'),
          institucion: reserva.institucion
        }
      };
    });
    
    console.log(`📅 Calendario - Eventos generados:`, eventos.length);
    console.log(`📅 Calendario - Primeros 3 eventos:`, eventos.slice(0, 3));
    
    return eventos;
  };

  const handleAprobarReserva = async (reservaId: number) => {
    try {
      // VALIDACIÓN DE SEGURIDAD: Verificar si el admin puede aprobar esta reserva
      if (esAdmin && !esSuperAdmin) {
        const reserva = reservas.find(r => r.id === reservaId);
        if (!reserva) {
          toast({
            title: "Error",
            description: "No se encontró la reserva.",
            variant: "destructive",
          });
          return;
        }

        // Verificar si el admin es responsable de la sala
        const salaIds = salasResponsable.map(sala => sala.id);
        if (!salaIds.includes(reserva.sala?.id)) {
          toast({
            title: "Acceso denegado",
            description: "No tienes permisos para aprobar reservas de esta sala.",
            variant: "destructive",
          });
          console.log('🚫 Admin intentó aprobar reserva de sala no autorizada:', reserva.sala?.nombre);
          return;
        }
      }

      const { error } = await supabase
        .from('reservas')
        .update({ estado: 'aprobada' })
        .eq('id', reservaId)
        .select() // Asegurarse de que la operación devuelva algo si tuvo éxito

      if (error) {
        console.error("Error al aprobar reserva:", error)
        throw error;
      }
      
      await fetchReservas() // Actualiza la lista/calendario
      toast({
        title: "Reserva aprobada",
        description: "La reserva ha sido aprobada exitosamente.",
        variant: "default", // O el estilo por defecto que prefieras
      })
      setDetalleAbierto(false) // Cerrar el modal de detalles
    } catch (error: any) {
      console.error("Catch - Error al aprobar reserva:", error)
      toast({
        title: "Error al aprobar",
        description: `No se pudo aprobar la reserva: ${error.message || 'Error desconocido'}`,
        variant: "destructive",
      })
      // Considera si quieres cerrar el modal también en caso de error
      // setDetalleAbierto(false) 
    }
  }

  const handleRechazarReserva = async (reservaId: number) => {
    // Validar que el comentario no esté vacío
    if (!comentarioRechazo || comentarioRechazo.trim() === '') {
      toast({
        title: "Error",
        description: "Por favor, ingresa un motivo para rechazar la reserva.",
        variant: "destructive",
      });
      return; // Detener la ejecución si no hay comentario
    }
    
    try {
      // VALIDACIÓN DE SEGURIDAD: Verificar si el admin puede rechazar esta reserva
      if (esAdmin && !esSuperAdmin) {
        const reserva = reservas.find(r => r.id === reservaId);
        if (!reserva) {
          toast({
            title: "Error",
            description: "No se encontró la reserva.",
            variant: "destructive",
          });
          return;
        }

        // Verificar si el admin es responsable de la sala
        const salaIds = salasResponsable.map(sala => sala.id);
        if (!salaIds.includes(reserva.sala?.id)) {
          toast({
            title: "Acceso denegado",
            description: "No tienes permisos para rechazar reservas de esta sala.",
            variant: "destructive",
          });
          console.log('🚫 Admin intentó rechazar reserva de sala no autorizada:', reserva.sala?.nombre);
          return;
        }
      }
      
      const { error } = await supabase
        .from('reservas')
        .update({ 
          estado: 'rechazada',
          motivo_rechazo: comentarioRechazo || null
        })
        .eq('id', reservaId)

      if (error) throw error
      
      await fetchReservas()
      setDetalleAbierto(false)
      setDialogoRechazoAbierto(false)
      setComentarioRechazo('')
      
      toast({
        title: "Reserva rechazada",
        description: "La reserva ha sido rechazada exitosamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo rechazar la reserva",
        variant: "destructive",
      })
    }
  }

  const exportarExcel = () => {
    // CORRECCIÓN: Filtrar reservas según responsabilidad para la exportación
    let reservasParaExportar = reservas.filter(r => r.usuario?.id !== '4a8794b5-139a-4d5d-a9da-dc2873665ca9');
    
    if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
      const salaIds = salasResponsable.map(sala => sala.id);
      reservasParaExportar = reservasParaExportar.filter(reserva => 
        reserva.sala && salaIds.includes(reserva.sala.id)
      );
      console.log('📋 Exportación filtrada para admin:', reservasParaExportar.length, 'reservas');
    }
    
    // Preparar datos para el reporte con información más completa (usando reservas filtradas)
    const datosReservas = reservasParaExportar.map(reserva => {
        const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
        
        // Formatear la fecha de reserva correctamente (CORREGIDO)
        const fechaReserva = new Date(reserva.fecha + 'T00:00:00');
        const fechaFormateada = fechaReserva.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        // Formatear fechas de creación y actualización
        const fechaCreacion = reserva.created_at ? new Date(reserva.created_at).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A';
        
        const fechaActualizacion = reserva.ultima_actualizacion ? new Date(reserva.ultima_actualizacion).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A';

        // Calcular tiempo de respuesta (días entre creación y aprobación/rechazo)
        const tiempoRespuesta = reserva.created_at && reserva.ultima_actualizacion && 
          reserva.estado !== 'pendiente' ? 
          Math.ceil((new Date(reserva.ultima_actualizacion).getTime() - new Date(reserva.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A';

        // Determinar franja horaria
        const horaInicio = parseInt(reserva.hora_inicio.split(':')[0]);
        let franjaHoraria = '';
        if (horaInicio >= 8 && horaInicio < 12) {
          franjaHoraria = 'Mañana';
        } else if (horaInicio >= 12 && horaInicio < 18) {
          franjaHoraria = 'Tarde';
        } else {
          franjaHoraria = 'Noche';
        }

        // Determinar tipo de uso académico (CORREGIDO)
        let tipoUsoAcademico = 'Otro';
        if (reserva.es_reserva_sistema) {
          tipoUsoAcademico = 'Clase Regular';
        } else if (reserva.nombre_modulo || reserva.codigo_asignatura) {
          tipoUsoAcademico = 'Actividad Académica';
        } else if (reserva.es_externo) {
          tipoUsoAcademico = 'Actividad Externa';
        }

        // Calcular días de anticipación de la reserva
        const diasAnticipacion = reserva.created_at ? 
          Math.max(0, Math.ceil((new Date(reserva.fecha).getTime() - new Date(reserva.created_at).getTime()) / (1000 * 60 * 60 * 24))) : 'N/A';

        // ===== CAMPOS CRÍTICOS AÑADIDOS/CORREGIDOS =====
        
        // RUT del solicitante (CORREGIDO)
        const rutSolicitante = reserva.es_externo 
          ? 'N/A (Externo)'
          : reserva.usuario?.rut || 'N/A';

        // Información del solicitante interno (para reservas externas)
        const solicitanteInterno = reserva.es_externo && reserva.usuario
          ? `${reserva.usuario.nombre} ${reserva.usuario.apellido} (${reserva.usuario.rut})`
          : 'N/A';

        // Información del aprobador (NUEVO)
        const aprobadorNombre = 'PENDIENTE: Implementar campo aprobador';
        const aprobadorRut = 'PENDIENTE: Implementar campo aprobador';

        // Preaviso (NUEVO)
        const esPreaviso = diasAnticipacion !== 'N/A' && diasAnticipacion < 1 ? 'SÍ' : 'NO';

        return {
          'ID': reserva.id,
          'Fecha de Reserva': fechaFormateada,
          'Sala': reserva.sala?.nombre || 'Sin asignar',
          'Tipo de Sala': reserva.sala?.tipo || 'N/A',
          'Capacidad Sala': reserva.sala?.capacidad || 'N/A',
          'Centro': reserva.sala?.centro || 'N/A',
          'Hora Inicio': reserva.hora_inicio,
          'Hora Fin': reserva.hora_fin,
          'Duración (horas)': duracion.toFixed(2),
          'Franja Horaria': franjaHoraria,
          'Estado': reserva.estado,
          'Es Urgente': reserva.es_urgente ? 'SÍ' : 'NO',
          'Tipo Solicitante': reserva.es_externo ? 'Externo' : 'Interno',
          'Tipo de Uso Académico': tipoUsoAcademico,
          
          // ===== INFORMACIÓN DEL SOLICITANTE (CORREGIDA) =====
          'Nombre Solicitante': reserva.es_externo 
            ? reserva.solicitante_nombre_completo || 'Sin nombre'
            : `${reserva.usuario?.nombre || ''} ${reserva.usuario?.apellido || ''}`.trim() || 'Sin usuario',
          'RUT Solicitante': rutSolicitante,
          'Solicitante Interno (para externos)': solicitanteInterno,
          'Email Solicitante': reserva.es_externo 
            ? reserva.mail_externos || 'N/A'
            : reserva.usuario?.email || 'N/A',
          'Teléfono': reserva.telefono || 'N/A',
          'Institución': reserva.institucion || (reserva.es_externo ? 'Sin especificar' : 'UTalca'),
          'Rol Usuario': reserva.usuario?.rol || 'N/A',
          'Departamento Usuario': reserva.usuario?.departamento || 'N/A',
          'Es Preaviso': esPreaviso,
          
          // ===== INFORMACIÓN DEL APROBADOR (NUEVO) =====
          'Nombre Aprobador': aprobadorNombre,
          'RUT Aprobador': aprobadorRut,
          
          // ===== CAMPOS DEL SISTEMA (CORREGIDOS) =====
          'Es Reserva del Sistema': reserva.es_reserva_sistema === true ? 'SÍ' : 'NO',
          'Valor DEBUG es_reserva_sistema': String(reserva.es_reserva_sistema), // Campo temporal para depuración
          'Módulo/Asignatura': reserva.nombre_modulo || 'N/A',
          'Código Asignatura': reserva.codigo_asignatura || 'N/A',
          'Sección': reserva.seccion || 'N/A',
          'Profesor Responsable': reserva.profesor_responsable || 'N/A',
          
          // ===== COMENTARIOS Y RECHAZOS (SEPARADOS) =====
          'Comentarios': reserva.comentario || 'Sin comentarios',
          'Motivo de Rechazo': reserva.motivo_rechazo || (reserva.estado === 'rechazada' ? 'Sin motivo especificado' : 'N/A'),
          
          // ===== FECHAS Y MÉTRICAS =====
          'Fecha de Creación': fechaCreacion,
          'Última Actualización': fechaActualizacion,
          'Tiempo de Respuesta (días)': tiempoRespuesta,
          'Días de Anticipación': diasAnticipacion,
          'Día de la Semana': fechaReserva.toLocaleDateString('es-ES', { weekday: 'long' }),
          'Mes': fechaReserva.toLocaleDateString('es-ES', { month: 'long' }),
          'Año': fechaReserva.getFullYear(),
          'Trimestre': Math.ceil((fechaReserva.getMonth() + 1) / 3),
          'Semana del Año': Math.ceil(fechaReserva.getDate() / 7)
        }
      })

    // Crear estadísticas generales más detalladas (usando reservas filtradas)
    const reservasCompletas = reservasParaExportar;
    const totalHoras = reservasCompletas.reduce((total, r) => total + calcularDuracion(r.hora_inicio, r.hora_fin), 0);
    const reservasAprobadas = reservasCompletas.filter(r => r.estado === 'aprobada');
    const reservasRechazadas = reservasCompletas.filter(r => r.estado === 'rechazada');
    const reservasUrgentes = reservasCompletas.filter(r => r.es_urgente);
    const reservasExternas = reservasCompletas.filter(r => r.es_externo);
    const reservasSistema = reservasCompletas.filter(r => r.es_reserva_sistema);

    const estadisticas = [
      { Métrica: 'Total de Reservas', Valor: reservasCompletas.length, Porcentaje: '100%' },
      { Métrica: 'Reservas Pendientes', Valor: reservasCompletas.filter(r => r.estado === 'pendiente').length, Porcentaje: `${((reservasCompletas.filter(r => r.estado === 'pendiente').length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Aprobadas', Valor: reservasAprobadas.length, Porcentaje: `${((reservasAprobadas.length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Rechazadas', Valor: reservasRechazadas.length, Porcentaje: `${((reservasRechazadas.length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Urgentes', Valor: reservasUrgentes.length, Porcentaje: `${((reservasUrgentes.length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Externas', Valor: reservasExternas.length, Porcentaje: `${((reservasExternas.length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas del Sistema', Valor: reservasSistema.length, Porcentaje: `${((reservasSistema.length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas en Preaviso', Valor: datosReservas.filter(r => r['Es Preaviso'] === 'SÍ').length, Porcentaje: `${((datosReservas.filter(r => r['Es Preaviso'] === 'SÍ').length / reservasCompletas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Horas Totales Reservadas', Valor: totalHoras.toFixed(2), Porcentaje: '' },
      { Métrica: 'Promedio de Duración (horas)', Valor: reservasCompletas.length > 0 ? (totalHoras / reservasCompletas.length).toFixed(2) : '0', Porcentaje: '' }
    ]

    // Crear libro de trabajo con múltiples hojas
    const wb = XLSX.utils.book_new()
    
    // Hoja principal con todas las reservas (CORREGIDA)
    const wsReservas = XLSX.utils.json_to_sheet(datosReservas)
    XLSX.utils.book_append_sheet(wb, wsReservas, 'Reservas Completas')
    
    // Hoja de estadísticas generales
    const wsEstadisticas = XLSX.utils.json_to_sheet(estadisticas)
    XLSX.utils.book_append_sheet(wb, wsEstadisticas, 'Estadísticas Generales')
    
    // Generar archivo con nombre más descriptivo
    const fechaHoy = new Date().toISOString().split('T')[0]
    const tipoReporte = esAdmin && !esSuperAdmin ? '_Admin_Filtrado' : '_Completo';
    const nombreArchivo = `Reporte${tipoReporte}_Reservas_UTalca_${fechaHoy}.xlsx`
    
    XLSX.writeFile(wb, nombreArchivo)
  }

  // Filtrar datos según el rol y responsabilidad
  useEffect(() => {
    if (loadingReservasData || loadingSalasResponsable) return



    let reservasFiltradas = reservasData

    // Si es admin (no superadmin), aplicar filtro por salas responsables
    if (esAdmin && !esSuperAdmin) {
      if (salasResponsable.length === 0) {

        setReservas([])
        return
      }

      const salaIds = salasResponsable.map(sala => sala.id)


      // Filtrar reservas por salas responsables
      reservasFiltradas = reservasData.filter(reserva => 
        reserva.sala && salaIds.includes(reserva.sala.id)
      )


    } else if (esSuperAdmin) {

    }

    setReservas(reservasFiltradas)
  }, [reservasData, salasResponsable, loadingReservasData, esAdmin, esSuperAdmin])

  if (loadingReservasData || loadingUsuariosData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Cargando estadísticas...</span>
        </div>
        

      </div>
    )
  }



  // Mostrar contenido forzado o cuando termine la carga
  if ((loadingReservasData || loadingSalasResponsable || loadingUsuariosData) && !forceShowContent) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Cargando datos...</span>
        </div>
      </div>
    )
  }

  // Protección de autenticación - mostrar loading mientras se verifica el usuario
  if (userLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Verificando autenticación...</span>
        </div>
      </div>
    )
  }

  // Si no hay usuario después de terminar de cargar, no renderizar (useUser ya maneja la redirección)
  if (!userLoading && !user) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">Redirigiendo al login...</p>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar pantalla de redirección si se está redirigiendo
  if (redirecting || (user && !userLoading && !['admin', 'superadmin'].includes(user.rol))) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-amber-600 mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground mb-2">Solo los administradores pueden acceder al dashboard.</p>
            <p className="text-sm text-muted-foreground">Redirigiendo a tus reservas...</p>
          </div>
        </div>
      </div>
    )
  }

  // Verificar si el admin no tiene salas asignadas
  const adminSinSalas = esAdmin && !esSuperAdmin && salasResponsable.length === 0;

  return (
    <div className="container mx-auto py-8 px-4">


      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {esAdmin && !esSuperAdmin 
              ? `Panel de gestión de ${salasResponsable.length === 0 ? 'ninguna sala asignada' : `${salasResponsable.length} sala${salasResponsable.length > 1 ? 's' : ''} asignada${salasResponsable.length > 1 ? 's' : ''}`}`
              : esSuperAdmin 
                ? 'Panel de administración completo del sistema'
                : 'Bienvenido al panel de control'
            }
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="año">Este año</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={exportarExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          
          <Button variant="default" asChild>
            <Link href="/reservas">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Reserva
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerta para admin sin salas asignadas */}
      {adminSinSalas && (
        <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-medium text-amber-800">Sin salas asignadas</h3>
          </div>
          <p className="text-sm text-amber-700 mb-2">
            Tu cuenta de administrador no tiene salas asignadas. Contacta al superadministrador 
            para que te asigne las salas que debes gestionar.
          </p>
          <p className="text-xs text-amber-600">
            Mientras tanto, las estadísticas y funcionalidades del dashboard estarán limitadas.
          </p>
        </div>
      )}



      {/* Estadísticas Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsuarios}</div>
            <p className="text-xs text-muted-foreground">
              {stats.usuariosActivos} con reservas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reservas Hoy</CardTitle>
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reservasHoy}</div>
            <p className="text-xs text-muted-foreground">
              Programadas para hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reservasPendientes}</div>
            <p className="text-xs text-muted-foreground">
              Esperando aprobación
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Uso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((stats.reservasHoy / stats.totalUsuarios) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Reservas/Usuarios hoy
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tendencia de Reservas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.reservasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="fecha" 
                    tickFormatter={(value) => {
                      // Crear la fecha agregando tiempo local para evitar problemas de zona horaria
                      const [year, month, day] = value.split('-').map(Number);
                      const fecha = new Date(year, month - 1, day);
                      return fecha.toLocaleDateString('es-ES', { weekday: 'short' });
                    }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Uso por Tipo de Solicitante</CardTitle>
            <CardDescription>Distribución de horas reservadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.usoPorSolicitante}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => 
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {stats.usoPorSolicitante.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value.toFixed(2)} horas`, 'Uso']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {stats.usoPorSolicitante.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={`color-indicator color-indicator-${index % 5}`}></div>
                  <span className="text-sm">{entry.name}: {entry.count} reservas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas para administradores */}
      {mostrarAccionesRapidas && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-md">Acciones rápidas</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setMostrarAccionesRapidas(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Reservas Pendientes */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <h3 className="text-sm font-medium">Reservas pendientes</h3>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.reservasPendientes}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requieren aprobación
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/aprobaciones">
                    Ver pendientes
                  </Link>
                </Button>
              </div>
              
              {/* Salas más utilizadas */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border border-green-200 bg-green-50/50">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-green-600" />
                  <h3 className="text-sm font-medium">
                    {esAdmin && !esSuperAdmin ? 'Mis salas con mayor demanda' : 'Salas con mayor demanda'}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {esAdmin && !esSuperAdmin 
                    ? 'Salas bajo tu responsabilidad que necesitan atención' 
                    : 'Salas que necesitan más atención administrativa'
                  }
                </p>
                <div className="text-sm space-y-2">
                  {stats.tasaUsoSalas.slice(0, 3).map((sala, index) => {
                    // Calcular métricas útiles para el admin (usando reservas filtradas ya aplicadas en stats)
                    const reservasSala = reservas.filter(r => r.sala?.nombre === sala.name)
                    const reservasPendientes = reservasSala.filter(r => r.estado === 'pendiente').length
                    const reservasRechazadas = reservasSala.filter(r => r.estado === 'rechazada').length
                    const tasaRechazo = reservasSala.length > 0 ? (reservasRechazadas / reservasSala.length * 100).toFixed(0) : '0'
                    
                    // Determinar el tipo de alerta
                    let alertaColor = 'text-green-700'
                    let alertaTexto = 'Sin problemas'
                    
                    if (reservasPendientes > 3) {
                      alertaColor = 'text-red-700'  
                      alertaTexto = `${reservasPendientes} pendientes`
                    } else if (parseInt(tasaRechazo) > 30) {
                      alertaColor = 'text-orange-700'  
                      alertaTexto = `${tasaRechazo}% rechazadas`
                    } else if (reservasPendientes > 0) {
                      alertaColor = 'text-yellow-700'
                      alertaTexto = `${reservasPendientes} pendiente${reservasPendientes > 1 ? 's' : ''}`
                    }
                    
                    return (
                      <div key={index} className="flex justify-between items-center p-2 rounded bg-white/80">
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${
                            alertaColor === 'text-red-700' ? 'bg-red-500' : 
                            alertaColor === 'text-orange-700' ? 'bg-orange-500' :
                            alertaColor === 'text-yellow-700' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="truncate flex-1 text-xs font-medium" title={sala.name}>
                            {sala.name}
                          </span>
                        </div>
                        <div className="flex flex-col items-end text-xs">
                          <span className="font-medium text-green-700">
                            {reservasSala.length} reservas
                          </span>
                          <span className={`${alertaColor} font-medium`}>
                            {alertaTexto}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/aprobaciones">
                    Gestionar pendientes
                  </Link>
                </Button>
              </div>
              
              {/* Usuarios con reservas */}
              <div className="flex flex-col gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-medium">Usuarios con reservas</h3>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.usuariosActivos}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usuarios que han realizado al menos una reserva
                </p>
                <div className="text-xs text-muted-foreground">
                  de {stats.totalUsuarios} usuarios totales
                </div>
                {user?.rol === 'superadmin' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/usuarios">
                      Gestionar usuarios
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendario Semanal */}
      <Card className="mt-6 overflow-hidden">
        <CardHeader className="flex flex-col space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle>Calendario de Reservas</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
                  <span>Aprobada</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
                  <span>Pendiente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                  <span>Rechazada</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }}></div>
                  <span>Sistema</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6b7280' }}></div>
                  <span>Cancelada</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#d97706' }}></div>
                  <span>Vencida</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={calendarView === 'timeGridWeek' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => {
                    setCalendarView('timeGridWeek');
                    if (calendarRef.current) {
                      calendarRef.current.getApi().changeView('timeGridWeek');
                    }
                  }}
                >
                  Semana
                </Button>
                <Button 
                  variant={calendarView === 'timeGridDay' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => {
                    setCalendarView('timeGridDay');
                    if (calendarRef.current) {
                      calendarRef.current.getApi().changeView('timeGridDay');
                    }
                  }}
                >
                  Día
                </Button>
                <Button 
                  variant={calendarView === 'dayGridMonth' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => {
                    setCalendarView('dayGridMonth');
                    if (calendarRef.current) {
                      calendarRef.current.getApi().changeView('dayGridMonth');
                    }
                  }}
                >
                  Mes
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <Select value={salaSeleccionada} onValueChange={setSalaSeleccionada}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por sala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las salas</SelectItem>
                  {salas.map(sala => (
                    <SelectItem key={sala.id} value={sala.id.toString()}>
                      {sala.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="aprobada">Aprobadas</SelectItem>
                  <SelectItem value="rechazada">Rechazadas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                  <SelectItem value="vencida">Vencidas</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={usuarioFiltro} onValueChange={setUsuarioFiltro}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {usuarios
                    .filter(u => u.id !== '4a8794b5-139a-4d5d-a9da-dc2873665ca9') // Filtrar usuario sistema
                    .map(usuario => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.nombre} {usuario.apellido}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[600px] calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin, dayGridPlugin]}
              initialView="timeGridWeek"
              locale={esLocale}
              slotMinTime="08:00:00"
              slotMaxTime="21:30:00"
              allDaySlot={false}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '' // Quitamos los botones de vista ya que los manejamos con nuestros propios botones
              }}
              events={obtenerEventosCalendario()}
              eventClick={(info) => {
                // Buscar la reserva completa basada en el ID del evento
                const reservaId = Number(info.event.id);
                const reservaCompleta = reservas.find(r => r.id === reservaId);
                
                if (reservaCompleta) {
                  console.log('Evento seleccionado:', {
                    id: reservaCompleta.id,
                    fecha: reservaCompleta.fecha,
                    sala: reservaCompleta.sala?.nombre,
                    solicitante: info.event.extendedProps.solicitante
                  });
                  
                  setReservaSeleccionada(reservaCompleta);
                  setDetalleAbierto(true);
                } else {
                  console.error(`No se encontró la reserva con ID ${reservaId}`);
                  toast({
                    title: "Error",
                    description: "No se pudo cargar los detalles de la reserva",
                    variant: "destructive",
                  });
                }
              }}
              dateClick={handleDateClick}
              eventContent={(eventInfo) => (
                // Aplicar el color de fondo y texto al div principal
                <div 
                  className="p-1 text-xs cursor-pointer overflow-hidden h-full" 
                  style={{ 
                    backgroundColor: eventInfo.backgroundColor, 
                    color: eventInfo.textColor, // Usar el color de texto definido en el evento
                    borderColor: eventInfo.borderColor, // Opcional: mantener el borde si se desea
                    borderWidth: '1px', // Opcional: añadir borde para mejor separación
                    borderRadius: '3px' // Opcional: redondear esquinas
                  }}
                >
                  {/* Ya no necesitamos el punto coloreado */}
                  {/* <span 
                    className="w-2 h-2 rounded-full inline-block mt-[3px] flex-shrink-0" 
                    style={{ backgroundColor: eventInfo.backgroundColor }}
                  ></span> */}
                  <div className="flex-grow min-w-0"> {/* Contenedor para el texto */}
                  <div className="font-bold truncate">{eventInfo.event.title}</div>
                  <div className="truncate">
                    <span className="capitalize">{eventInfo.event.extendedProps.estado}</span>
                    {eventInfo.event.extendedProps.esUrgente && (
                        <span className="ml-1 px-1 py-0.5 bg-white/30 text-white rounded-sm text-[9px]"> {/* Ajustar estilo badge */}
                        Urgente
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px]">{eventInfo.event.extendedProps.sala}</div>
                  </div>
                </div>
              )}
              nowIndicator={true}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5, 6], // Lunes a sábado
                startTime: '08:00',
                endTime: '21:30',
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalle de reserva */}
      <Dialog open={detalleAbierto} onOpenChange={setDetalleAbierto}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Detalle de Reserva</DialogTitle>
            <DialogDescription>
              Información detallada de la reserva seleccionada.
            </DialogDescription>
          </DialogHeader>
          
          {reservaSeleccionada && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-[auto_1fr] items-start gap-4">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Solicitante:
                </span>
              <div>
                  <p className="font-medium">{reservaSeleccionada.es_externo 
                  ? reservaSeleccionada.solicitante_nombre_completo 
                    : `${reservaSeleccionada.usuario?.nombre} ${reservaSeleccionada.usuario?.apellido}`}</p>
                <p className="text-sm text-muted-foreground">
                  {reservaSeleccionada.es_externo 
                    ? reservaSeleccionada.institucion 
                    : reservaSeleccionada.usuario?.rol}
                </p>
              </div>
              
                <span className="text-muted-foreground flex items-center gap-2">
                   <Building className="h-4 w-4" />
                   Sala:
                </span>
                <p className="font-medium">{reservaSeleccionada.sala?.nombre}</p>

                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha y Hora:
                </span>
              <div>
                  <p className="font-medium">{new Date(reservaSeleccionada.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                <p className="text-sm text-muted-foreground">
                  {reservaSeleccionada.hora_inicio?.slice(0, 5)} - {reservaSeleccionada.hora_fin?.slice(0, 5)}
                </p>
                </div>
              </div>
              
              {/* Mostrar información académica para reservas del sistema o comentario para reservas manuales */}
              {reservaSeleccionada.es_reserva_sistema ? (
                // Información académica para reservas del sistema
                <>
                  {reservaSeleccionada.nombre_modulo && (
                    <div className="grid grid-cols-[auto_1fr] items-start gap-4 border-t pt-4">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Módulo:
                      </span>
                      <p className="text-sm font-medium">{reservaSeleccionada.nombre_modulo}</p>
                    </div>
                  )}
                  
                  {reservaSeleccionada.profesor_responsable && (
                    <div className="grid grid-cols-[auto_1fr] items-start gap-4">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Profesor:
                      </span>
                      <p className="text-sm">{reservaSeleccionada.profesor_responsable}</p>
                    </div>
                  )}
                </>
              ) : (
                // Comentario para reservas manuales
                reservaSeleccionada.comentario && (
                 <div className="grid grid-cols-[auto_1fr] items-start gap-4 border-t pt-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Comentario:
                    </span>
                  <p className="text-sm">{reservaSeleccionada.comentario}</p>
                </div>
                )
              )}
              
              {/* Mostrar motivo de rechazo si existe */}
              {reservaSeleccionada.estado === 'rechazada' && reservaSeleccionada.motivo_rechazo && (
                <div className="grid grid-cols-[auto_1fr] items-start gap-4 border-t pt-4">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Motivo de rechazo:
                  </span>
                  <p className="text-sm text-red-600">{reservaSeleccionada.motivo_rechazo}</p>
                </div>
              )}
              
              <div className={`grid grid-cols-[auto_1fr] items-center gap-4 ${!(reservaSeleccionada.es_reserva_sistema ? (reservaSeleccionada.nombre_modulo || reservaSeleccionada.profesor_responsable) : reservaSeleccionada.comentario) && !(reservaSeleccionada.estado === 'rechazada' && reservaSeleccionada.motivo_rechazo) ? 'border-t pt-4' : ''}`}>
                <span className="text-muted-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Estado:
                </span>
              <div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  reservaSeleccionada.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                  reservaSeleccionada.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                  reservaSeleccionada.estado === 'rechazada' ? 'bg-red-100 text-red-800' :
                    reservaSeleccionada.estado === 'cancelada' ? 'bg-gray-100 text-gray-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {reservaSeleccionada.estado.charAt(0).toUpperCase() + reservaSeleccionada.estado.slice(1)}
                  </span>
                </div>
              </div>
              
              {reservaSeleccionada.estado === 'pendiente' && (() => {
                // VALIDACIÓN DE SEGURIDAD: Solo mostrar botones si el usuario tiene permisos
                if (esAdmin && !esSuperAdmin) {
                  const salaIds = salasResponsable.map(sala => sala.id);
                  const puedeGestionar = salaIds.includes(reservaSeleccionada.sala?.id);
                  
                  if (!puedeGestionar) {
                    return (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-700">
                            No tienes permisos para gestionar reservas de esta sala.
                          </p>
                        </div>
                      </div>
                    );
                  }
                }
                
                // Si es superadmin o admin con permisos, mostrar botones
                return (
                <DialogFooter className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogoRechazoAbierto(true)
                    }}
                  >
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => handleAprobarReserva(reservaSeleccionada.id)}
                  >
                    Aprobar
                  </Button>
                </DialogFooter>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            value={comentarioRechazo}
            onChange={(e) => setComentarioRechazo(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoRechazoAbierto(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleRechazarReserva(reservaSeleccionada?.id)}
              disabled={!comentarioRechazo || comentarioRechazo.trim() === ''}
            >
              Rechazar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


