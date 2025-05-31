"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useReservasData } from '@/hooks/useReservasData'
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import Link from 'next/link'
import { Download, BarChart3, PieChart as PieChartIcon, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import * as XLSX from 'xlsx'

// Función para calcular la duración en horas entre dos horas
const calcularDuracion = (horaInicio: string, horaFin: string): number => {
  const inicio = new Date(`2000-01-01T${horaInicio}`)
  const fin = new Date(`2000-01-01T${horaFin}`)
  return (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)
}

export default function Dashboard() {
  const { reservas, salas, loading } = useReservasData()
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'semana' | 'mes' | 'trimestre' | 'año'>('mes')
  const [stats, setStats] = useState({
    reservasPendientes: 0,
    reservasHoy: 0,
    salasDisponibles: [] as Array<{ name: string; value: number }>
  })
  const [tasaUsoSalas, setTasaUsoSalas] = useState<Array<{ name: string; horas: number; porcentaje: number }>>([])
  const [usoPorSolicitante, setUsoPorSolicitante] = useState<Array<{ name: string; value: number; count: number }>>([])

  useEffect(() => {
    if (loading || reservas.length === 0) return

    const today = new Date().toISOString().split('T')[0]
    
    // Calcular estadísticas básicas
    const reservasPendientes = reservas.filter(r => r.estado === 'pendiente').length
    const reservasHoy = reservas.filter(r => r.fecha === today).length

    // Calcular disponibilidad de salas
    const salasStats = reservas.reduce<Record<string, { total: number; disponible: number }>>((acc, reserva) => {
      const nombreSala = reserva.sala?.nombre || 'Sin Sala'
      if (!acc[nombreSala]) {
        acc[nombreSala] = { total: 1, disponible: reserva.estado === 'pendiente' ? 0 : 1 }
      } else {
        acc[nombreSala].total += 1
        if (reserva.estado !== 'pendiente') acc[nombreSala].disponible += 1
      }
      return acc
    }, {})

    const salasDisponibles = Object.entries(salasStats).map(([name, stats]) => ({
      name,
      value: (stats.disponible / stats.total) * 100
    }))

    setStats({
      reservasPendientes,
      reservasHoy,
      salasDisponibles
    })

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
    const reservasFiltradas = reservas.filter(r => 
      r.estado === 'aprobada' && r.fecha >= fechaLimiteStr
    )

    // Calcular tasa de uso por sala (en horas)
    const horasPorSala: Record<string, { horas: number; capacidadTotal: number }> = {}
    
    // Calcular horas totales disponibles por sala (8:00 a 19:00 = 11 horas por día)
    const horasDiarias = 11
    const diasEnPeriodo = (() => {
      switch (periodoSeleccionado) {
        case 'semana': return 7
        case 'mes': return 30
        case 'trimestre': return 90
        case 'año': return 365
      }
    })()

    // Inicializar horas disponibles por sala
    salas.forEach(sala => {
      horasPorSala[sala.nombre] = { 
        horas: 0, 
        capacidadTotal: horasDiarias * diasEnPeriodo 
      }
    })

    // Sumar horas de uso por sala
    reservasFiltradas.forEach(reserva => {
      if (reserva.sala) {
        const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
        const nombreSala = reserva.sala.nombre
        
        if (!horasPorSala[nombreSala]) {
          horasPorSala[nombreSala] = { 
            horas: 0, 
            capacidadTotal: horasDiarias * diasEnPeriodo 
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

    setTasaUsoSalas(tasaUsoSalasData)

    // Calcular uso por tipo de solicitante
    const usoPorTipo: Record<string, { value: number; count: number }> = {
      'Interno': { value: 0, count: 0 },
      'Externo': { value: 0, count: 0 }
    }

    reservasFiltradas.forEach(reserva => {
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

    setUsoPorSolicitante(usoPorSolicitanteData)

  }, [reservas, salas, periodoSeleccionado, loading])

  const COLORS = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#8884D8']

  const exportarExcel = () => {
    // Preparar datos para el reporte
    const datosReservas = reservas.map(reserva => {
      const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      // Formatear la fecha de reserva correctamente
      const fechaReserva = new Date(reserva.fecha);
      const fechaFormateada = fechaReserva.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      return {
        'ID': reserva.id,
        'Fecha': fechaFormateada, // Usar la fecha formateada
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

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-4">
          <Select value={periodoSeleccionado} onValueChange={(value: any) => setPeriodoSeleccionado(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Última semana</SelectItem>
              <SelectItem value="mes">Último mes</SelectItem>
              <SelectItem value="trimestre">Último trimestre</SelectItem>
              <SelectItem value="año">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportarExcel} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar a Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Resumen */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm text-muted-foreground">Reservas Pendientes</h3>
              <p className="text-2xl font-bold">{stats.reservasPendientes}</p>
            </div>
            <div>
              <h3 className="text-sm text-muted-foreground">Reservas Hoy</h3>
              <p className="text-2xl font-bold">{stats.reservasHoy}</p>
            </div>
            <div>
              <h3 className="text-sm text-muted-foreground">Total Salas</h3>
              <p className="text-2xl font-bold">{salas.length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Uso por tipo de solicitante */}
        <Card>
          <CardHeader>
            <CardTitle>Uso por Tipo de Solicitante</CardTitle>
            <CardDescription>Distribución de horas reservadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={usoPorSolicitante}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {usoPorSolicitante.map((entry, index) => (
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
              {usoPorSolicitante.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-sm">{entry.name}: {entry.count} reservas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accesos Rápidos */}
        <Card>
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/gestion-salas" className="w-full">
              <Button variant="default" className="w-full">
                Gestión de Salas
              </Button>
            </Link>
            <Link href="/reservas" className="w-full">
              <Button variant="default" className="w-full">
                Reservas de Salas
              </Button>
            </Link>
            <Link href="/aprobaciones" className="w-full">
              <Button variant="default" className="w-full">
                Aprobaciones
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Tasa de uso por sala */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tasa de Uso por Sala</CardTitle>
          <CardDescription>Horas de uso y porcentaje de ocupación en el período seleccionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tasaUsoSalas}
                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70}
                  interval={0}
                />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Horas', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Porcentaje', angle: 90, position: 'insideRight' }} />
                <Tooltip formatter={(value: any, name: string) => {
                  if (name === 'horas') return [`${value.toFixed(2)} horas`, 'Horas de uso']
                  if (name === 'porcentaje') return [`${value.toFixed(2)}%`, 'Porcentaje de ocupación']
                  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const fecha = new Date(value);
                    return [fecha.toLocaleDateString('es-ES'), name];
                  }
                  return [value, name]
                }} />
                <Legend />
                <Bar yAxisId="left" dataKey="horas" name="Horas de uso" fill="#8884d8" />
                <Bar yAxisId="right" dataKey="porcentaje" name="Porcentaje de ocupación" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 