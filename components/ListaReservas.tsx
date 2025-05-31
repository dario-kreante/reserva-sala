'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock4,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Building
} from "lucide-react"

interface Reserva {
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
  motivo_rechazo: string | null
  nombre_modulo: string | null
  codigo_asignatura: string | null
  seccion: string | null
  profesor_responsable: string | null
}

interface ListaReservasProps {
  reservas: Reserva[]
  onReservaClick?: (reserva: Reserva) => void
  mostrarAcciones?: boolean
  onAprobar?: (reservaId: number) => void
  onRechazar?: (reservaId: number) => void
}

export default function ListaReservas({ 
  reservas, 
  onReservaClick, 
  mostrarAcciones = false,
  onAprobar,
  onRechazar 
}: ListaReservasProps) {
  
  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatearHora = (hora: string) => {
    return hora.substring(0, 5)
  }

  const obtenerIconoEstado = (estado: string) => {
    switch (estado) {
      case 'aprobada':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rechazada':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pendiente':
        return <Clock4 className="h-4 w-4 text-yellow-600" />
      case 'cancelada':
        return <XCircle className="h-4 w-4 text-gray-600" />
      default:
        return <Clock4 className="h-4 w-4 text-gray-600" />
    }
  }

  const obtenerColorEstado = (estado: string) => {
    switch (estado) {
      case 'aprobada':
        return 'bg-green-100 text-green-800'
      case 'rechazada':
        return 'bg-red-100 text-red-800'
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelada':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (reservas.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No hay reservas para mostrar</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reservas.map((reserva) => (
        <Card 
          key={reserva.id} 
          className={`cursor-pointer hover:shadow-md transition-shadow ${
            reserva.es_urgente ? 'border-l-4 border-l-red-500' : ''
          }`}
          onClick={() => onReservaClick?.(reserva)}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {obtenerIconoEstado(reserva.estado)}
                <div>
                  <h3 className="font-semibold text-lg">
                    {reserva.sala?.nombre || 'Sin sala asignada'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {reserva.sala?.tipo || 'Tipo no especificado'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {reserva.es_urgente && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Urgente
                  </Badge>
                )}
                
                {reserva.es_externo && (
                  <Badge variant="secondary" className="text-xs">
                    <Building className="h-3 w-3 mr-1" />
                    Externo
                  </Badge>
                )}
                
                {reserva.es_reserva_sistema && (
                  <Badge variant="outline" className="text-xs">
                    <BookOpen className="h-3 w-3 mr-1" />
                    Sistema
                  </Badge>
                )}
                
                <Badge className={`text-xs ${obtenerColorEstado(reserva.estado)}`}>
                  {reserva.estado.charAt(0).toUpperCase() + reserva.estado.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{formatearFecha(reserva.fecha)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  {formatearHora(reserva.hora_inicio)} - {formatearHora(reserva.hora_fin)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  {reserva.es_externo 
                    ? (reserva.solicitante_nombre_completo || 'Solicitante externo')
                    : `${reserva.usuario?.nombre || ''} ${reserva.usuario?.apellido || ''}`.trim() || 'Usuario sin nombre'
                  }
                </span>
              </div>

              {reserva.institucion && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{reserva.institucion}</span>
                </div>
              )}
            </div>

            {/* Información académica para reservas del sistema */}
            {reserva.es_reserva_sistema && (reserva.nombre_modulo || reserva.profesor_responsable || reserva.codigo_asignatura || reserva.seccion) && (
              <div className="space-y-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800">Información Académica:</p>
                
                {reserva.nombre_modulo && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      <strong>Módulo:</strong> {reserva.nombre_modulo}
                    </span>
                  </div>
                )}
                
                {reserva.codigo_asignatura && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-700">
                      <strong>Código:</strong> {reserva.codigo_asignatura}
                    </span>
                  </div>
                )}
                
                {reserva.seccion && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-700">
                      <strong>Sección:</strong> {reserva.seccion}
                    </span>
                  </div>
                )}
                
                {reserva.profesor_responsable && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      <strong>Profesor:</strong> {reserva.profesor_responsable}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {/* Mostrar motivo de rechazo si existe y está rechazada */}
              {reserva.estado === 'rechazada' && reserva.motivo_rechazo && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Motivo de rechazo:</p>
                    <p className="text-sm text-red-600">{reserva.motivo_rechazo}</p>
                  </div>
                </div>
              )}
              
              {/* Mostrar comentarios si existen */}
              {reserva.comentario && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <MessageSquare className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Comentarios:</p>
                    <p className="text-sm text-gray-600">{reserva.comentario}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Botones de acción para administradores */}
            {mostrarAcciones && reserva.estado === 'pendiente' && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAprobar?.(reserva.id)
                  }}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprobar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRechazar?.(reserva.id)
                  }}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Rechazar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 