'use client'

import { useEffect, useState, useRef } from 'react'
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
  User, Building, Calendar, MessageSquare, Tag
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
  const [reservas, setReservas] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [salas, setSalas] = useState<any[]>([])
  const [loadingReservas, setLoadingReservas] = useState(true)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [loadingSalas, setLoadingSalas] = useState(true)
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

  useEffect(() => {
    if (!loadingReservasData) {
      setReservas(reservasData)
      setLoadingReservas(false)
    }
    if (!loadingUsuariosData) {
      setUsuarios(usuariosData)
      setLoadingUsuarios(false)
    }
    if (salasData.length > 0) {
      setSalas(salasData)
      setLoadingSalas(false)
    }
  }, [loadingReservasData, loadingUsuariosData, reservasData, usuariosData, salasData])

  useEffect(() => {
    if (!loadingReservas && !loadingUsuarios) {
      // Calcular fecha de hoy en formato YYYY-MM-DD para comparación
      const hoy = new Date().toISOString().split('T')[0];
      console.log(`Fecha de hoy para estadísticas: ${hoy}`);
      
      // Contar reservas pendientes
      const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
      
      // Contar reservas de hoy - normalizar el formato de fecha de cada reserva para comparar
      const reservasHoy = reservas.filter(r => {
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
      
      // Calcular usuarios activos (con al menos una reserva)
      const usuariosActivos = new Set(reservas.filter(r => r.usuario?.id).map(r => r.usuario!.id)).size;
      
      // Distribución de roles
      const roles = usuarios.reduce<Record<string, number>>((acc, user) => {
        acc[user.rol] = (acc[user.rol] || 0) + 1
        return acc
      }, {})

      // Uso por sala (usando reservasFiltradas)
      const usoPorSala = reservas.reduce<Record<string, number>>((acc, reserva) => {
        const nombreSala = reserva.sala?.nombre || 'Sin Sala'
        acc[nombreSala] = (acc[nombreSala] || 0) + 1
        return acc
      }, {})

      // Reservas por día (usando reservasFiltradas)
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
      
      // Contar reservas por día
      reservas.forEach(reserva => {
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
          console.error(`Error al procesar fecha para estadísticas: ${reserva.fecha}`, error);
        }
      });
      
      // Convertir a formato para el gráfico
      const reservasPorDiaArray = Object.entries(reservasPorDia).map(([fecha, total]) => ({
        fecha,
        total
      })).sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Calcular tasa de uso por sala (en horas)
      const horasPorSala: Record<string, { horas: number; capacidadTotal: number }> = {}
      
      // Calcular horas totales disponibles por sala (8:00 a 19:00 = 11 horas por día)
      const horasDiarias = 11
      
      // Definir días según el período seleccionado
      let diasPeriodo = 30; // valor por defecto
      if (periodoSeleccionado === 'semana') {
        diasPeriodo = 7;
      } else if (periodoSeleccionado === 'mes') {
        diasPeriodo = 30;
      } else if (periodoSeleccionado === 'año') {
        diasPeriodo = 365;
      }
      
      // Inicializar horas disponibles por sala
      salas.forEach(sala => {
        horasPorSala[sala.nombre] = { 
          horas: 0, 
          capacidadTotal: horasDiarias * diasPeriodo 
        }
      })

      // Sumar horas de uso por sala
      reservas.forEach(reserva => {
        if (reserva.sala) {
          const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
          const nombreSala = reserva.sala.nombre
          
          if (!horasPorSala[nombreSala]) {
            horasPorSala[nombreSala] = { 
              horas: 0, 
              capacidadTotal: horasDiarias * diasPeriodo 
            }
          }
          
          horasPorSala[nombreSala].horas += duracion
        }
      })

      // Convertir a array para el gráfico
      const tasaUsoSalasData = Object.entries(horasPorSala)
        .map(([name, { horas, capacidadTotal }]) => ({
          name,
          horas,
          porcentaje: Math.min((horas / capacidadTotal) * 100, 100) // Limitar a 100%
        }))
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10) // Mostrar solo las 10 salas más usadas

      // Calcular uso por tipo de solicitante
      const usoPorTipo: Record<string, { value: number; count: number }> = {
        'Interno': { value: 0, count: 0 },
        'Externo': { value: 0, count: 0 }
      }

      reservas.forEach(reserva => {
        const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
        const tipoSolicitante = reserva.es_externo ? 'Externo' : 'Interno'
        
        usoPorTipo[tipoSolicitante].value += duracion
        usoPorTipo[tipoSolicitante].count += 1
      })

      const usoPorSolicitanteData = Object.entries(usoPorTipo)
        .map(([name, stats]) => ({
          name,
          value: stats.value,
          count: stats.count
        }))

      setStats({
        totalUsuarios: usuarios.length,
        usuariosActivos,
        reservasHoy,
        reservasPendientes: pendientes,
        reservasPorDia: reservasPorDiaArray,
        distribucionRoles: Object.entries(roles).map(([name, value]) => ({ name, value })),
        usoPorSala: Object.entries(usoPorSala).map(([name, value]) => ({ name, value })),
        tasaUsoSalas: tasaUsoSalasData,
        usoPorSolicitante: usoPorSolicitanteData
      })
    }
  }, [loadingReservas, loadingUsuarios, reservas, usuarios, salas, periodoSeleccionado])

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
    console.log(`Total reservas filtradas para calendario: ${reservasFiltradas.length}`);
    
    return reservasFiltradas.map(reserva => {
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
      
      // Crear el evento para el calendario
      return {
        id: reserva.id.toString(),
        title: reserva.es_externo ? 
          (reserva.solicitante_nombre_completo || 'Externo') : 
          (reserva.usuario?.nombre ? `${reserva.usuario.nombre} ${reserva.usuario.apellido || ''}` : 'Usuario'),
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
  };

  const handleAprobarReserva = async (reservaId: number) => {
    try {
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
      const { error } = await supabase
        .from('reservas')
        .update({ 
          estado: 'rechazada',
          comentario: comentarioRechazo || null
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
    // Preparar datos para el reporte
    const datosReservas = reservas
      .filter(r => r.usuario?.id !== '4a8794b5-139a-4d5d-a9da-dc2873665ca9')
      .map(reserva => {
        const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
        return {
          'ID': reserva.id,
          'Fecha': reserva.fecha,
          'Sala': reserva.sala?.nombre || 'Sin asignar',
          'Tipo de Sala': reserva.sala?.tipo || 'N/A',
          'Hora Inicio': reserva.hora_inicio,
          'Hora Fin': reserva.hora_fin,
          'Duración (horas)': duracion.toFixed(2),
          'Estado': reserva.estado,
          'Urgente': reserva.es_urgente ? 'Sí' : 'No',
          'Tipo Solicitante': reserva.es_externo ? 'Externo' : 'Interno',
          'Solicitante': reserva.es_externo 
            ? reserva.solicitante_nombre_completo 
            : `${reserva.usuario?.nombre || ''} ${reserva.usuario?.apellido || ''}`,
          'Institución': reserva.institucion || 'N/A'
        }
      })

    // Crear hoja de cálculo
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosReservas)
    
    // Añadir hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Reservas')
    
    // Generar archivo y descargarlo
    XLSX.writeFile(wb, `Reporte_Reservas_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loadingReservas || loadingUsuarios) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido al panel de control. Aquí tienes un resumen del sistema.
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
              {stats.usuariosActivos} activos
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
                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { weekday: 'short' })}
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
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Reservas pendientes</h3>
                <div className="text-2xl font-bold">{stats.reservasPendientes}</div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/aprobaciones">
                    Ver pendientes
                  </Link>
                </Button>
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Salas más utilizadas</h3>
                <div className="text-sm">
                  {stats.tasaUsoSalas.slice(0, 3).map((sala, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{sala.name}</span>
                      <span className="font-medium">{sala.porcentaje.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/gestion-salas">
                    Gestionar salas
                  </Link>
                </Button>
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Usuarios activos</h3>
                <div className="text-2xl font-bold">{stats.usuariosActivos}</div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/usuarios">
                    Gestionar usuarios
                  </Link>
                </Button>
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
              slotMaxTime="20:00:00"
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
                endTime: '20:00',
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
              
              {reservaSeleccionada.comentario && (
                 <div className="grid grid-cols-[auto_1fr] items-start gap-4 border-t pt-4">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Comentario:
                    </span>
                  <p className="text-sm">{reservaSeleccionada.comentario}</p>
                </div>
              )}
              
              <div className={`grid grid-cols-[auto_1fr] items-center gap-4 ${!reservaSeleccionada.comentario ? 'border-t pt-4' : ''}`}>
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
              
              {reservaSeleccionada.estado === 'pendiente' && (
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
              )}
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


