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
import { toast } from "@/components/ui/use-toast"

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
    console.log('🚀 Exportando Excel con funcionalidad mejorada v2.0');
    console.log('📊 Total de reservas a exportar:', reservas.length);
    
    // Preparar datos para el reporte con información más completa
    const datosReservas = reservas.map(reserva => {
      const duracion = calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      // Formatear la fecha de reserva correctamente
      const fechaReserva = new Date(reserva.fecha);
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

      // Determinar tipo de uso académico
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
        'Es Urgente': reserva.es_urgente ? 'Sí' : 'No',
        'Tipo Solicitante': reserva.es_externo ? 'Externo' : 'Interno',
        'Tipo de Uso Académico': tipoUsoAcademico,
        'Solicitante': reserva.es_externo 
          ? reserva.solicitante_nombre_completo || 'Sin nombre'
          : `${reserva.usuario?.nombre || ''} ${reserva.usuario?.apellido || ''}`.trim() || 'Sin usuario',
        'Email Solicitante': reserva.es_externo 
          ? reserva.mail_externos || 'N/A'
          : reserva.usuario?.email || 'N/A',
        'Teléfono': reserva.telefono || 'N/A',
        'Institución': reserva.institucion || (reserva.es_externo ? 'Sin especificar' : 'UTalca'),
        'Rol Usuario': reserva.usuario?.rol || 'N/A',
        'Departamento Usuario': reserva.usuario?.departamento || 'N/A',
        'Es Reserva del Sistema': reserva.es_reserva_sistema ? 'Sí' : 'No',
        'Módulo/Asignatura': reserva.nombre_modulo || 'N/A',
        'Código Asignatura': reserva.codigo_asignatura || 'N/A',
        'Sección': reserva.seccion || 'N/A',
        'Profesor Responsable': reserva.profesor_responsable || 'N/A',
        'Comentarios': reserva.comentario || 'Sin comentarios',
        'Motivo de Rechazo': reserva.motivo_rechazo || (reserva.estado === 'rechazada' ? 'Sin motivo especificado' : 'N/A'),
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

    console.log('📋 Ejemplo de datos de reserva procesada:', datosReservas[0]);
    console.log('🔍 Campos incluidos en cada reserva:', Object.keys(datosReservas[0] || {}));

    // Crear estadísticas generales más detalladas
    const totalHoras = reservas.reduce((total, r) => total + calcularDuracion(r.hora_inicio, r.hora_fin), 0);
    const reservasAprobadas = reservas.filter(r => r.estado === 'aprobada');
    const reservasRechazadas = reservas.filter(r => r.estado === 'rechazada');
    const reservasUrgentes = reservas.filter(r => r.es_urgente);
    const reservasExternas = reservas.filter(r => r.es_externo);
    const reservasSistema = reservas.filter(r => r.es_reserva_sistema);

    // Calcular tasa de aprobación
    const tasaAprobacion = reservas.length > 0 ? 
      ((reservasAprobadas.length / (reservasAprobadas.length + reservasRechazadas.length)) * 100).toFixed(2) : '0';

    // Tiempo promedio de respuesta
    const tiemposRespuesta = reservas
      .filter(r => r.created_at && r.ultima_actualizacion && r.estado !== 'pendiente')
      .map(r => Math.ceil((new Date(r.ultima_actualizacion!).getTime() - new Date(r.created_at!).getTime()) / (1000 * 60 * 60 * 24)));
    const tiempoPromedioRespuesta = tiemposRespuesta.length > 0 ? 
      (tiemposRespuesta.reduce((a, b) => a + b, 0) / tiemposRespuesta.length).toFixed(1) : '0';

    const estadisticas = [
      { Métrica: 'Total de Reservas', Valor: reservas.length, Porcentaje: '100%' },
      { Métrica: 'Reservas Pendientes', Valor: reservas.filter(r => r.estado === 'pendiente').length, Porcentaje: `${((reservas.filter(r => r.estado === 'pendiente').length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Aprobadas', Valor: reservasAprobadas.length, Porcentaje: `${((reservasAprobadas.length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Rechazadas', Valor: reservasRechazadas.length, Porcentaje: `${((reservasRechazadas.length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Canceladas', Valor: reservas.filter(r => r.estado === 'cancelada').length, Porcentaje: `${((reservas.filter(r => r.estado === 'cancelada').length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Tasa de Aprobación', Valor: `${tasaAprobacion}%`, Porcentaje: '' },
      { Métrica: 'Reservas Urgentes', Valor: reservasUrgentes.length, Porcentaje: `${((reservasUrgentes.length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas Externas', Valor: reservasExternas.length, Porcentaje: `${((reservasExternas.length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Reservas del Sistema', Valor: reservasSistema.length, Porcentaje: `${((reservasSistema.length / reservas.length) * 100).toFixed(1)}%` },
      { Métrica: 'Horas Totales Reservadas', Valor: totalHoras.toFixed(2), Porcentaje: '' },
      { Métrica: 'Promedio de Duración (horas)', Valor: reservas.length > 0 ? (totalHoras / reservas.length).toFixed(2) : '0', Porcentaje: '' },
      { Métrica: 'Tiempo Promedio de Respuesta (días)', Valor: tiempoPromedioRespuesta, Porcentaje: '' },
             { Métrica: 'Total de Salas Utilizadas', Valor: new Set(reservas.filter(r => r.sala?.id).map(r => r.sala!.id)).size, Porcentaje: '' },
       { Métrica: 'Total de Usuarios Activos', Valor: new Set(reservas.filter(r => r.usuario?.id).map(r => r.usuario!.id)).size, Porcentaje: '' }
    ]

    // Uso por sala con información más detallada
    const usoPorSala = reservas.reduce((acc, reserva) => {
      const nombreSala = reserva.sala?.nombre || 'Sin sala'
      const tipoSala = reserva.sala?.tipo || 'N/A'
      const capacidadSala = reserva.sala?.capacidad || 0
      const centroSala = reserva.sala?.centro || 'N/A'
      
      if (!acc[nombreSala]) {
        acc[nombreSala] = { 
          count: 0, 
          horas: 0, 
          aprobadas: 0, 
          rechazadas: 0, 
          pendientes: 0,
          urgentes: 0,
          externas: 0,
          tipo: tipoSala,
          capacidad: capacidadSala,
          centro: centroSala
        }
      }
      acc[nombreSala].count += 1
      acc[nombreSala].horas += calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      if (reserva.estado === 'aprobada') acc[nombreSala].aprobadas += 1
      if (reserva.estado === 'rechazada') acc[nombreSala].rechazadas += 1
      if (reserva.estado === 'pendiente') acc[nombreSala].pendientes += 1
      if (reserva.es_urgente) acc[nombreSala].urgentes += 1
      if (reserva.es_externo) acc[nombreSala].externas += 1
      
      return acc
    }, {} as Record<string, any>)

    const datosSalas = Object.entries(usoPorSala).map(([sala, datos]) => ({
      'Sala': sala,
      'Tipo': datos.tipo,
      'Capacidad': datos.capacidad,
      'Centro': datos.centro,
      'Total Reservas': datos.count,
      'Horas Totales': datos.horas.toFixed(2),
      'Promedio Horas por Reserva': (datos.horas / datos.count).toFixed(2),
      'Reservas Aprobadas': datos.aprobadas,
      'Reservas Rechazadas': datos.rechazadas,
      'Reservas Pendientes': datos.pendientes,
      'Reservas Urgentes': datos.urgentes,
      'Reservas Externas': datos.externas,
      'Tasa de Aprobación': datos.count > 0 ? `${((datos.aprobadas / (datos.aprobadas + datos.rechazadas)) * 100).toFixed(1)}%` : '0%',
      'Tasa de Ocupación': `${((datos.horas / (datos.count * 11)) * 100).toFixed(1)}%` // Asumiendo 11 horas por día
    }))

    // Análisis por usuarios
    const usoPorUsuario = reservas.reduce((acc, reserva) => {
      const nombreUsuario = reserva.es_externo 
        ? reserva.solicitante_nombre_completo || 'Usuario Externo Sin Nombre'
        : `${reserva.usuario?.nombre || ''} ${reserva.usuario?.apellido || ''}`.trim() || 'Sin usuario'
      
      const emailUsuario = reserva.es_externo 
        ? reserva.mail_externos || 'N/A'
        : reserva.usuario?.email || 'N/A'
      
      const rolUsuario = reserva.usuario?.rol || (reserva.es_externo ? 'Externo' : 'N/A')
      const departamentoUsuario = reserva.usuario?.departamento || 'N/A'
      
      if (!acc[nombreUsuario]) {
        acc[nombreUsuario] = { 
          count: 0, 
          horas: 0, 
          aprobadas: 0, 
          rechazadas: 0,
          urgentes: 0,
          email: emailUsuario,
          rol: rolUsuario,
          departamento: departamentoUsuario,
          esExterno: reserva.es_externo
        }
      }
      acc[nombreUsuario].count += 1
      acc[nombreUsuario].horas += calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      if (reserva.estado === 'aprobada') acc[nombreUsuario].aprobadas += 1
      if (reserva.estado === 'rechazada') acc[nombreUsuario].rechazadas += 1
      if (reserva.es_urgente) acc[nombreUsuario].urgentes += 1
      
      return acc
    }, {} as Record<string, any>)

    const datosUsuarios = Object.entries(usoPorUsuario)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 100) // Top 100 usuarios más activos
      .map(([usuario, datos]) => ({
        'Usuario': usuario,
        'Email': datos.email,
        'Rol': datos.rol,
        'Departamento': datos.departamento,
        'Tipo': datos.esExterno ? 'Externo' : 'Interno',
        'Total Reservas': datos.count,
        'Horas Totales': datos.horas.toFixed(2),
        'Reservas Aprobadas': datos.aprobadas,
        'Reservas Rechazadas': datos.rechazadas,
        'Reservas Urgentes': datos.urgentes,
        'Tasa de Aprobación': datos.count > 0 ? `${((datos.aprobadas / (datos.aprobadas + datos.rechazadas)) * 100).toFixed(1)}%` : '0%'
      }))

    // Análisis temporal
    const usoTemporal = reservas.reduce((acc, reserva) => {
      const fecha = new Date(reserva.fecha)
      const año = fecha.getFullYear()
      const mes = fecha.getMonth() + 1
      const dia = fecha.getDate()
      const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' })
      const horaInicio = parseInt(reserva.hora_inicio.split(':')[0])
      
      // Por año-mes
      const añoMes = `${año}-${mes.toString().padStart(2, '0')}`
      if (!acc.porMes[añoMes]) {
        acc.porMes[añoMes] = { count: 0, horas: 0 }
      }
      acc.porMes[añoMes].count += 1
      acc.porMes[añoMes].horas += calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      // Por día de la semana
      if (!acc.porDiaSemana[diaSemana]) {
        acc.porDiaSemana[diaSemana] = { count: 0, horas: 0 }
      }
      acc.porDiaSemana[diaSemana].count += 1
      acc.porDiaSemana[diaSemana].horas += calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      // Por franja horaria
      let franjaHoraria = ''
      if (horaInicio >= 8 && horaInicio < 12) {
        franjaHoraria = 'Mañana (8-12h)'
      } else if (horaInicio >= 12 && horaInicio < 16) {
        franjaHoraria = 'Tarde (12-16h)'
      } else if (horaInicio >= 16 && horaInicio < 20) {
        franjaHoraria = 'Tarde-Noche (16-20h)'
      } else {
        franjaHoraria = 'Fuera de horario'
      }
      
      if (!acc.porFranja[franjaHoraria]) {
        acc.porFranja[franjaHoraria] = { count: 0, horas: 0 }
      }
      acc.porFranja[franjaHoraria].count += 1
      acc.porFranja[franjaHoraria].horas += calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
      
      return acc
    }, { porMes: {} as any, porDiaSemana: {} as any, porFranja: {} as any })

    // Convertir análisis temporal a arrays para Excel
    const datosPorMes = Object.entries(usoTemporal.porMes).map(([mes, datos]: [string, any]) => ({
      'Año-Mes': mes,
      'Total Reservas': datos.count,
      'Total Horas': datos.horas.toFixed(2),
      'Promedio Reservas por Día': (datos.count / 30).toFixed(1) // Aproximado
    }))

    const datosPorDiaSemana = Object.entries(usoTemporal.porDiaSemana).map(([dia, datos]: [string, any]) => ({
      'Día de la Semana': dia,
      'Total Reservas': datos.count,
      'Total Horas': datos.horas.toFixed(2),
      'Porcentaje del Total': `${((datos.count / reservas.length) * 100).toFixed(1)}%`
    }))

    const datosPorFranja = Object.entries(usoTemporal.porFranja).map(([franja, datos]: [string, any]) => ({
      'Franja Horaria': franja,
      'Total Reservas': datos.count,
      'Total Horas': datos.horas.toFixed(2),
      'Porcentaje del Total': `${((datos.count / reservas.length) * 100).toFixed(1)}%`
    }))

    // Análisis por departamentos
    const usoPorDepartamento = reservas
      .filter(r => !r.es_externo && r.usuario?.departamento)
      .reduce((acc, reserva) => {
        const departamento = reserva.usuario!.departamento!
        if (!acc[departamento]) {
          acc[departamento] = { count: 0, horas: 0, usuarios: new Set() }
        }
        acc[departamento].count += 1
        acc[departamento].horas += calcularDuracion(reserva.hora_inicio, reserva.hora_fin)
                 acc[departamento].usuarios.add(reserva.usuario!.id)
        return acc
      }, {} as Record<string, any>)

    const datosDepartamentos = Object.entries(usoPorDepartamento).map(([dept, datos]) => ({
      'Departamento': dept,
      'Total Reservas': datos.count,
      'Total Horas': datos.horas.toFixed(2),
      'Usuarios Únicos': datos.usuarios.size,
      'Promedio Reservas por Usuario': (datos.count / datos.usuarios.size).toFixed(1),
      'Promedio Horas por Usuario': (datos.horas / datos.usuarios.size).toFixed(1)
    }))

    // Crear libro de trabajo con múltiples hojas
    const wb = XLSX.utils.book_new()
    
    // Hoja principal con todas las reservas
    const wsReservas = XLSX.utils.json_to_sheet(datosReservas)
    XLSX.utils.book_append_sheet(wb, wsReservas, 'Reservas Completas')
    
    // Hoja de estadísticas generales
    const wsEstadisticas = XLSX.utils.json_to_sheet(estadisticas)
    XLSX.utils.book_append_sheet(wb, wsEstadisticas, 'Estadísticas Generales')
    
    // Hoja de análisis por sala
    const wsSalas = XLSX.utils.json_to_sheet(datosSalas)
    XLSX.utils.book_append_sheet(wb, wsSalas, 'Análisis por Sala')
    
    // Hoja de análisis por usuario
    const wsUsuarios = XLSX.utils.json_to_sheet(datosUsuarios)
    XLSX.utils.book_append_sheet(wb, wsUsuarios, 'Top 100 Usuarios')
    
    // Hojas de análisis temporal
    const wsPorMes = XLSX.utils.json_to_sheet(datosPorMes)
    XLSX.utils.book_append_sheet(wb, wsPorMes, 'Uso por Mes')
    
    const wsPorDiaSemana = XLSX.utils.json_to_sheet(datosPorDiaSemana)
    XLSX.utils.book_append_sheet(wb, wsPorDiaSemana, 'Uso por Día Semana')
    
    const wsPorFranja = XLSX.utils.json_to_sheet(datosPorFranja)
    XLSX.utils.book_append_sheet(wb, wsPorFranja, 'Uso por Franja Horaria')
    
    // Hoja de análisis por departamento
    if (datosDepartamentos.length > 0) {
      const wsDepartamentos = XLSX.utils.json_to_sheet(datosDepartamentos)
      XLSX.utils.book_append_sheet(wb, wsDepartamentos, 'Análisis por Departamento')
    }
    
    // Generar archivo con nombre más descriptivo
    const fechaHoy = new Date().toISOString().split('T')[0]
    const nombreArchivo = `Reporte_Completo_Reservas_Institucional_${fechaHoy}.xlsx`
    
    console.log('📁 Generando archivo Excel:', nombreArchivo);
    console.log('📊 Hojas incluidas en el archivo:', wb.SheetNames);
    
    XLSX.writeFile(wb, nombreArchivo)
    
    // Mostrar mensaje de éxito
    toast({
      title: "Exportación exitosa",
      description: `Se ha generado el archivo ${nombreArchivo} con ${reservas.length} reservas y análisis institucional completo`,
    })
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
          <Button onClick={() => {
            console.log('🔥 BOTÓN EXPORTAR PRESIONADO - VERSIÓN NUEVA');
            alert('Exportando con nueva funcionalidad...');
            exportarExcel();
          }} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar NUEVO Excel Completo
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