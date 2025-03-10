"use client"

import { useState, useEffect } from 'react'
import { Calendar } from "@/components/ui/calendar"
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SelectSingleEventHandler } from 'react-day-picker'
import { Button } from "@/components/ui/button"

interface DisponibilidadCalendarioProps {
  salaId: number | null
  onDateSelect?: (date: Date) => void
  className?: string
}

interface DiaDisponibilidad {
  fecha: string
  dia: number
  dia_semana: number
  disponible: boolean
  bloques_disponibles: number
  bloques_totales: number
  porcentaje_disponibilidad: number
}

interface DisponibilidadData {
  sala: {
    id: number
    nombre: string
    tipo: string
    capacidad: number
    centro: string
  }
  anio: number
  mes: number
  nombre_mes: string
  dias: DiaDisponibilidad[]
  dias_disponibles: number
  dias_totales: number
}

export function DisponibilidadCalendario({ 
  salaId, 
  onDateSelect,
  className 
}: DisponibilidadCalendarioProps) {
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [diasDisponibles, setDiasDisponibles] = useState<Record<string, boolean>>({})
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null)
  
  // Función para obtener la disponibilidad de la sala para el mes actual
  const fetchDisponibilidad = async () => {
    if (!salaId) return
    
    setLoading(true)
    setError(null)
    setDebugInfo(null)
    
    try {
      const anio = currentDate.getFullYear()
      const mes = currentDate.getMonth() + 1 // JavaScript meses son 0-11
      
      console.log(`Consultando disponibilidad para sala ${salaId}, año ${anio}, mes ${mes}`)
      
      // Primero intentamos obtener información de la sala para verificar que existe
      const { data: salaData, error: salaError } = await supabase
        .from('salas')
        .select('id, nombre, tipo, capacidad, centro')
        .eq('id', salaId)
        .single()
      
      if (salaError) {
        console.error('Error al obtener información de la sala:', salaError)
        throw new Error(`Error al obtener información de la sala: ${salaError.message}`)
      }
      
      if (!salaData) {
        throw new Error(`No se encontró la sala con ID ${salaId}`)
      }
      
      setDebugInfo(prev => ({ ...prev, sala: salaData }))
      
      // Intentamos con la nueva función v2 primero
      const { data: dataV2, error: errorV2 } = await supabase
        .rpc('obtener_disponibilidad_sala_mes_json_v2', {
          p_sala_id: salaId,
          p_anio: anio,
          p_mes: mes
        })
      
      if (errorV2) {
        console.error('Error con función v2:', errorV2)
        setDebugInfo(prev => ({ ...prev, errorV2 }))
        
        // Si falla la v2, intentamos con la original
        const { data, error } = await supabase
          .rpc('obtener_disponibilidad_sala_mes_json', {
            p_sala_id: salaId,
            p_anio: anio,
            p_mes: mes
          })
        
        if (error) {
          console.error('Error de Supabase:', error)
          setDebugInfo(prev => ({ ...prev, error }))
          throw new Error(`Error al obtener disponibilidad: ${error.message}`)
        }
        
        if (!data) {
          throw new Error('No se recibieron datos de disponibilidad')
        }
        
        console.log('Datos de disponibilidad recibidos (función original):', data)
        setDebugInfo(prev => ({ ...prev, data }))
        
        setDisponibilidad(data)
        
        // Crear un mapa de días disponibles para facilitar la renderización
        const diasMap: Record<string, boolean> = {}
        if (data.dias && Array.isArray(data.dias)) {
          data.dias.forEach((dia: DiaDisponibilidad) => {
            diasMap[dia.fecha] = dia.disponible
          })
        } else {
          console.error('Formato de datos incorrecto:', data)
          throw new Error('Formato de datos de disponibilidad incorrecto')
        }
        
        setDiasDisponibles(diasMap)
      } else {
        // La función v2 funcionó
        console.log('Datos de disponibilidad recibidos (función v2):', dataV2)
        setDebugInfo(prev => ({ ...prev, dataV2 }))
        
        setDisponibilidad(dataV2)
        
        // Crear un mapa de días disponibles para facilitar la renderización
        const diasMap: Record<string, boolean> = {}
        if (dataV2.dias && Array.isArray(dataV2.dias)) {
          dataV2.dias.forEach((dia: DiaDisponibilidad) => {
            diasMap[dia.fecha] = dia.disponible
          })
        } else {
          console.error('Formato de datos incorrecto:', dataV2)
          throw new Error('Formato de datos de disponibilidad incorrecto')
        }
        
        setDiasDisponibles(diasMap)
      }
      
    } catch (err: any) {
      console.error('Error al obtener disponibilidad:', err)
      setError(err.message || 'No se pudo cargar la disponibilidad de la sala')
    } finally {
      setLoading(false)
    }
  }
  
  // Cargar disponibilidad cuando cambia la sala o el mes
  useEffect(() => {
    fetchDisponibilidad()
  }, [salaId, currentDate])
  
  // Función para cambiar el mes
  const handleMonthChange = (date: Date) => {
    // Solo actualizar si el mes o año cambian
    if (
      date.getMonth() !== currentDate.getMonth() ||
      date.getFullYear() !== currentDate.getFullYear()
    ) {
      setCurrentDate(date)
    }
  }
  
  // Adaptador para el evento onSelect del calendario
  const handleDateSelect: SelectSingleEventHandler = (day) => {
    if (day && onDateSelect) {
      const dateStr = format(day, 'yyyy-MM-dd')
      // Solo permitir seleccionar días disponibles
      if (diasDisponibles[dateStr]) {
        onDateSelect(day)
      } else {
        // Opcional: mostrar un mensaje de que el día no está disponible
      }
    }
  }
  
  // Función para determinar si un día está disponible
  const isDayAvailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return diasDisponibles[dateStr] === true
  }
  
  // Función para determinar si un día está ocupado
  const isDayUnavailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return diasDisponibles[dateStr] === false
  }
  
  // Función para reintentar la carga de disponibilidad
  const handleRetry = () => {
    fetchDisponibilidad()
  }
  
  return (
    <div className={cn("p-4 bg-white rounded-lg shadow", className)}>
      <div className="mb-4">
        <h3 className="text-lg font-medium">
          Disponibilidad de sala
        </h3>
        {disponibilidad && (
          <p className="text-sm text-muted-foreground">
            {disponibilidad.sala.nombre} - {disponibilidad.dias_disponibles} días disponibles
          </p>
        )}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="text-center p-4">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-sm text-muted-foreground mb-4">
            Es posible que las funciones SQL necesarias no estén instaladas correctamente en la base de datos.
          </p>
          <div className="flex justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
            >
              Reintentar
            </Button>
            <a 
              href="/debug" 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ir a depuración
            </a>
          </div>
          
          {debugInfo && (
            <div className="mt-4 text-left">
              <details className="text-xs">
                <summary className="cursor-pointer text-blue-500 hover:underline">
                  Mostrar información de depuración
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded-md overflow-auto max-h-40 text-xs">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      ) : (
        <Calendar
          mode="single"
          locale={es}
          onSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
          className="rounded-md border"
          modifiers={{
            available: isDayAvailable,
            unavailable: isDayUnavailable
          }}
          modifiersClassNames={{
            available: "bg-green-100 text-green-800 hover:bg-green-200",
            unavailable: "bg-red-50 text-red-700 hover:bg-red-100",
            today: "bg-blue-100 text-blue-900",
            selected: "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
          }}
          disabled={{ before: new Date() }}
        />
      )}
      
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-100 mr-1"></div>
          <span>Disponible</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-50 mr-1"></div>
          <span>No disponible</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-100 mr-1"></div>
          <span>Hoy</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-600 mr-1"></div>
          <span>Seleccionado</span>
        </div>
      </div>
    </div>
  )
} 