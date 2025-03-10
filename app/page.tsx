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
import esLocale from '@fullcalendar/core/locales/es'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'
import { 
  Users, CalendarCheck2, Clock, TrendingUp,
  BarChart3, PieChart as PieChartIcon, Download, Plus, X
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
  const [reservaSeleccionada, setReservaSeleccionada] = useState<any>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);

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
      const today = new Date().toISOString().split('T')[0]
      const reservasFiltradas = reservas.filter(r => r.usuario?.id !== '4a8794b5-139a-4d5d-a9da-dc2873665ca9')
      
      // Estadísticas básicas
      const usuariosActivos = usuarios.filter(u => u.activo).length
      const reservasHoy = reservasFiltradas.filter(r => r.fecha === today).length
      const reservasPendientes = reservasFiltradas.filter(r => r.estado === 'pendiente').length

      // Distribución de roles
      const roles = usuarios.reduce<Record<string, number>>((acc, user) => {
        acc[user.rol] = (acc[user.rol] || 0) + 1
        return acc
      }, {})

      // Uso por sala (usando reservasFiltradas)
      const usoPorSala = reservasFiltradas.reduce<Record<string, number>>((acc, reserva) => {
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

      const reservasPorDia = ultimos7Dias.map(fecha => ({
        fecha,
        total: reservasFiltradas.filter(r => r.fecha === fecha).length
      }))

      // Filtrar reservas según el período seleccionado
      const fechaLimite = new Date()
      switch (periodoSeleccionado) {
        case 'semana':
          fechaLimite.setDate(fechaLimite.getDate() - 7)
          break
        case 'mes':
          fechaLimite.setMonth(fechaLimite.getMonth() - 1)
          break
        case 'trimestre':
          fechaLimite.setMonth(fechaLimite.getMonth() - 3)
          break
        case 'año':
          fechaLimite.setFullYear(fechaLimite.getFullYear() - 1)
          break
      }

      const fechaLimiteStr = fechaLimite.toISOString().split('T')[0]
      const reservasPeriodo = reservasFiltradas.filter(r => 
        r.estado === 'aprobada' && r.fecha >= fechaLimiteStr
      )

      // Calcular tasa de uso por sala (en horas)
      const horasPorSala: Record<string, { horas: number; capacidadTotal: number }> = {}
      
      // Calcular horas totales disponibles por sala (8:00 a 19:00 = 11 horas por día)
      const horasDiarias = 11
      
      // Definir días según el periodo seleccionado
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
      reservasPeriodo.forEach(reserva => {
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

      reservasPeriodo.forEach(reserva => {
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
        reservasPendientes,
        reservasPorDia,
        distribucionRoles: Object.entries(roles).map(([name, value]) => ({ name, value })),
        usoPorSala: Object.entries(usoPorSala).map(([name, value]) => ({ name, value })),
        tasaUsoSalas: tasaUsoSalasData,
        usoPorSolicitante: usoPorSolicitanteData
      })
    }
  }, [loadingReservas, loadingUsuarios, reservas, usuarios, salas, periodoSeleccionado])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

  const obtenerEventosCalendario = () => {
    return reservas
      .filter(r => r.usuario?.id !== '4a8794b5-139a-4d5d-a9da-dc2873665ca9')
      .filter(r => salaSeleccionada === 'todas' || r.sala?.id.toString() === salaSeleccionada)
      .map(reserva => ({
        id: reserva.id.toString(),
        title: `${reserva.sala?.nombre || 'Sin sala'} - ${reserva.usuario?.nombre || 'Usuario'}`,
        start: `${reserva.fecha}T${reserva.hora_inicio}`,
        end: `${reserva.fecha}T${reserva.hora_fin}`,
        backgroundColor: getColorPorEstado(reserva.estado),
        borderColor: getColorPorEstado(reserva.estado),
        extendedProps: {
          estado: reserva.estado,
          sala: reserva.sala?.nombre,
          usuario: reserva.usuario?.nombre,
          reservaCompleta: reserva
        }
      }))
  }

  const getColorPorEstado = (estado: string) => {
    switch (estado) {
      case 'aprobada': return '#10B981'
      case 'pendiente': return '#F59E0B'
      case 'rechazada': return '#EF4444'
      default: return '#6B7280'
    }
  }

  const handleAprobarReserva = async (reservaId: number) => {
    try {
      const { error } = await supabase
        .from('reservas')
        .update({ estado: 'aprobada' })
        .eq('id', reservaId)

      if (error) throw error
      
      await fetchReservas()
      toast({
        title: "Reserva aprobada",
        description: "La reserva ha sido aprobada exitosamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo aprobar la reserva",
        variant: "destructive",
      })
    }
  }

  const handleRechazarReserva = async (reservaId: number) => {
    try {
      const { error } = await supabase
        .from('reservas')
        .update({ estado: 'rechazada' })
        .eq('id', reservaId)

      if (error) throw error
      
      await fetchReservas()
      toast({
        title: "Reserva rechazada",
        description: "La reserva ha sido rechazada",
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
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs">Aprobada</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-xs">Pendiente</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-xs">Rechazada</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[600px] calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin]}
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
              hiddenDays={[0]} // Ocultar domingo (0 = domingo, 1 = lunes, etc.)
              events={obtenerEventosCalendario().filter(evento => {
                // Filtrar por estado si es necesario
                if (estadoFiltro !== 'todos' && evento.extendedProps.estado !== estadoFiltro) {
                  return false;
                }
                
                // Filtrar por usuario si es necesario
                if (usuarioFiltro !== 'todos' && evento.extendedProps.usuario === usuarioFiltro) {
                  return false;
                }
                
                return true;
              })}
              eventClick={(info) => {
                setReservaSeleccionada(info.event.extendedProps.reservaCompleta);
                setDetalleAbierto(true);
              }}
              eventContent={(eventInfo) => (
                <div className="p-1 text-xs cursor-pointer overflow-hidden">
                  <div className="font-bold truncate">{eventInfo.event.title}</div>
                  <div className="truncate capitalize">{eventInfo.event.extendedProps.estado}</div>
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

      {/* Dialog para mostrar detalles de la reserva */}
      <Dialog open={detalleAbierto} onOpenChange={setDetalleAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalles de la reserva</DialogTitle>
          </DialogHeader>
          {reservaSeleccionada && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm font-medium">Sala:</p>
                  <p className="text-sm">{reservaSeleccionada.sala?.nombre}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Estado:</p>
                  <p className={`text-sm capitalize ${
                    reservaSeleccionada.estado === 'aprobada' ? 'text-green-600' : 
                    reservaSeleccionada.estado === 'pendiente' ? 'text-amber-600' : 
                    reservaSeleccionada.estado === 'rechazada' ? 'text-red-600' : 'text-gray-600'
                  }`}>{reservaSeleccionada.estado}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Usuario:</p>
                <p className="text-sm">{reservaSeleccionada.usuario?.nombre} {reservaSeleccionada.usuario?.apellido}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm font-medium">Fecha:</p>
                  <p className="text-sm">{new Date(reservaSeleccionada.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Hora:</p>
                  <p className="text-sm">{reservaSeleccionada.hora_inicio.substring(0, 5)} - {reservaSeleccionada.hora_fin.substring(0, 5)}</p>
                </div>
              </div>
              {reservaSeleccionada.estado === 'pendiente' && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      handleAprobarReserva(reservaSeleccionada.id);
                      setDetalleAbierto(false);
                    }}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      handleRechazarReserva(reservaSeleccionada.id);
                      setDetalleAbierto(false);
                    }}
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

