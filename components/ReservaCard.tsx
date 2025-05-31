import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, User, BookOpen, Users, GraduationCap } from 'lucide-react'
import { ReservaConDescripcion, generarTituloReserva } from '@/types/supabase'

interface ReservaCardProps {
  reserva: ReservaConDescripcion
  showDate?: boolean
  showSala?: boolean
  className?: string
}

export function ReservaCard({ 
  reserva, 
  showDate = true, 
  showSala = true,
  className = '' 
}: ReservaCardProps) {
  const titulo = generarTituloReserva(reserva)
  
  const formatearHora = (hora: string) => {
    return hora.slice(0, 5) // Formato HH:MM
  }

  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha)
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getEstadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case 'aprobada':
        return 'default'
      case 'pendiente':
        return 'secondary'
      case 'rechazada':
        return 'destructive'
      case 'cancelada':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'aprobada':
        return 'text-green-600'
      case 'pendiente':
        return 'text-yellow-600'
      case 'rechazada':
        return 'text-red-600'
      case 'cancelada':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
              {titulo}
            </CardTitle>
            
            {/* Información académica para reservas del sistema */}
            {reserva.es_reserva_sistema && (
              <div className="flex flex-wrap gap-2 mb-2">
                {reserva.codigo_asignatura && (
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {reserva.codigo_asignatura}
                  </Badge>
                )}
                {reserva.seccion && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    Sección {reserva.seccion}
                  </Badge>
                )}
                {reserva.profesor_responsable && (
                  <Badge variant="outline" className="text-xs">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    {reserva.profesor_responsable}
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge 
              variant={getEstadoBadgeVariant(reserva.estado)}
              className={getEstadoColor(reserva.estado)}
            >
              {reserva.estado.charAt(0).toUpperCase() + reserva.estado.slice(1)}
            </Badge>
            
            {reserva.es_reserva_sistema && (
              <Badge variant="secondary" className="text-xs">
                Sistema
              </Badge>
            )}
            
            {reserva.es_urgente && (
              <Badge variant="destructive" className="text-xs">
                Urgente
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Fecha */}
          {showDate && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-2" />
              <span className="capitalize">{formatearFecha(reserva.fecha)}</span>
            </div>
          )}
          
          {/* Horario */}
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            <span>
              {formatearHora(reserva.hora_inicio)} - {formatearHora(reserva.hora_fin)}
            </span>
          </div>
          
          {/* Sala */}
          {showSala && reserva.sala_nombre && (
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              <span>{reserva.sala_nombre}</span>
            </div>
          )}
          
          {/* Usuario (para reservas manuales) */}
          {!reserva.es_reserva_sistema && reserva.usuario_nombre && (
            <div className="flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-2" />
              <span>{reserva.usuario_nombre} {reserva.usuario_apellido}</span>
            </div>
          )}
          
          {/* Comentario */}
          {reserva.comentario && !reserva.es_reserva_sistema && (
            <div className="mt-3 p-2 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">{reserva.comentario}</p>
            </div>
          )}
          
          {/* Información adicional para reservas externas */}
          {reserva.es_externo && (
            <div className="mt-3 p-2 bg-blue-50 rounded-md">
              <div className="text-xs text-blue-700 space-y-1">
                {reserva.solicitante_nombre_completo && (
                  <div>Solicitante: {reserva.solicitante_nombre_completo}</div>
                )}
                {reserva.institucion && (
                  <div>Institución: {reserva.institucion}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 