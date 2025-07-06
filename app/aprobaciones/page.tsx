"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { useResponsableSalas } from '@/hooks/useResponsableSalas'
import { useUser } from '@/hooks/useUser'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Reserva {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  comentario?: string
  es_urgente: boolean
  es_externo: boolean
  solicitante_nombre_completo?: string
  institucion?: string
  sala: {
    id: number
    nombre: string
  }
  usuario: {
    id: string
    nombre: string
    apellido: string
    rol: string
    email: string
  }
}

export default function Aprobaciones() {
  // NOTA IMPORTANTE:
  // Para usuarios admin:
  // - Solo pueden ver y gestionar las reservas de las salas de las que son responsables.
  // - Si no son responsables de ninguna sala, no verán ninguna reserva para aprobar o rechazar.
  // 
  // Esta restricción es consistente con la política en la página de reservas, donde los administradores
  // pueden crear reservas en cualquier sala, pero solo pueden ver y gestionar las reservas
  // de las salas que tienen asignadas.

  const [reservas, setReservas] = useState<Reserva[]>([])
  const [filtroSala, setFiltroSala] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [salas, setSalas] = useState<{id: number, nombre: string}[]>([])
  const [ordenFecha, setOrdenFecha] = useState<'asc' | 'desc'>('asc')
  const { user } = useUser()
  const { 
    salasResponsable, 
    loading: loadingSalas, 
    puedeVerTodo,
    esSuperAdmin,
    esAdmin
  } = useResponsableSalas()

  // Estado para el diálogo de rechazo con comentario
  const [dialogoRechazoAbierto, setDialogoRechazoAbierto] = useState(false)
  const [reservaIdParaRechazar, setReservaIdParaRechazar] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // Añadir un estado para controlar la inicialización
  const [initialized, setInitialized] = useState(false)
  const fetchInProgress = useRef(false)
  
  // Mover esta verificación arriba, fuera del renderizado
  const adminSinSalas = esAdmin && !esSuperAdmin && salasResponsable.length === 0;

  const fetchReservas = async () => {
    // Evitar llamadas duplicadas durante la carga
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    
    try {
      // Salir inmediatamente si el admin no tiene salas asignadas
      if (adminSinSalas) {
        console.log('Admin no es responsable de ninguna sala: no se cargan reservas para aprobar')
        setReservas([])
        return
      }

      let query = supabase
        .from('reservas')
        .select(`
          *,
          sala:salas!inner(id, nombre),
          usuario:usuarios(id, nombre, apellido, email, rol)
        `)
        .eq('estado', 'pendiente')
        .eq('sala.activo', true)  // Filtrar solo reservas de salas activas
        .order('fecha', { ascending: ordenFecha === 'asc' })
        .order('hora_inicio')

      // Si el usuario es admin y no superadmin, filtrar por las salas de las que es responsable
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        const salaIds = salasResponsable.map(sala => sala.id)
        query = query.in('sala_id', salaIds)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching reservas:', error)
        return
      }

      setReservas(data || [])
    } catch (error) {
      console.error('Error general al obtener reservas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas",
        variant: "destructive",
      })
    } finally {
      fetchInProgress.current = false;
    }
  }

  const fetchSalas = async () => {
    // Salir inmediatamente si el admin no tiene salas asignadas
    if (adminSinSalas) {
      console.log('Admin no es responsable de ninguna sala: no se cargan salas')
      setSalas([])
      return
    }
    
    // Solo usar las salas responsables
    if (!loadingSalas) {
      setSalas(salasResponsable)
    }
  }

  useEffect(() => {
    if (!loadingSalas) {
      // Marcar como inicializado para controlar el renderizado
      setInitialized(true);
      
      // Si es admin sin salas, no ejecutar las funciones fetch
      if (adminSinSalas) {
        console.log('Admin sin salas: omitiendo todas las cargas de datos en aprobaciones');
        return;
      }
      
      fetchReservas()
      fetchSalas()
    }
  }, [ordenFecha, loadingSalas, salasResponsable, esAdmin, esSuperAdmin, adminSinSalas])

  // Optimizar la suscripción en tiempo real para aprobaciones
  useEffect(() => {
    // Solo configurar la suscripción si tenemos la información de las salas responsables
    // y no somos un admin sin salas
    if (!loadingSalas && !adminSinSalas) {
      console.log('Configurando suscripción en tiempo real para aprobaciones...')
      
      // Canal para las reservas pendientes
      let reservasPendientesSubscription;
      
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        const salaIds = salasResponsable.map(sala => sala.id)
        const salaIdsString = salaIds.join(',')
        
        // Suscribirse a los cambios de estado en reservas
        reservasPendientesSubscription = supabase
          .channel('aprobaciones-filtradas')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'reservas',
              filter: `sala_id=in.(${salaIdsString})`,
            },
            (payload) => {
              console.log('Nueva reserva detectada:', payload)
              // Actualizar solo si la nueva reserva está pendiente
              if (payload.new && payload.new.estado === 'pendiente') {
                fetchReservas()
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'reservas',
              filter: `sala_id=in.(${salaIdsString})`,
            },
            (payload) => {
              console.log('Cambio de estado en reserva detectado:', payload)
              // Actualizar si el estado anterior o el nuevo es pendiente
              if ((payload.old && payload.old.estado === 'pendiente') || 
                  (payload.new && payload.new.estado === 'pendiente')) {
                fetchReservas()
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'reservas',
              filter: `sala_id=in.(${salaIdsString})`,
            },
            (payload) => {
              console.log('Eliminación de reserva detectada:', payload)
              // Actualizar si la reserva eliminada estaba pendiente
              if (payload.old && payload.old.estado === 'pendiente') {
                fetchReservas()
              }
            }
          )
          .subscribe()
      } else {
        // Suscribirse a todos los cambios de reservas para cualquier sala
        // Solo para superadmin o usuarios no admin
        reservasPendientesSubscription = supabase
          .channel('aprobaciones')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'reservas',
            },
            (payload) => {
              console.log('Nueva reserva detectada:', payload)
              // Actualizar solo si la nueva reserva está pendiente
              if (payload.new && payload.new.estado === 'pendiente') {
                fetchReservas()
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'reservas',
            },
            (payload) => {
              console.log('Cambio de estado en reserva detectado:', payload)
              // Actualizar si el estado anterior o el nuevo es pendiente
              if ((payload.old && payload.old.estado === 'pendiente') || 
                  (payload.new && payload.new.estado === 'pendiente')) {
                fetchReservas()
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'reservas',
            },
            (payload) => {
              console.log('Eliminación de reserva detectada:', payload)
              // Actualizar si la reserva eliminada estaba pendiente
              if (payload.old && payload.old.estado === 'pendiente') {
                fetchReservas()
              }
            }
          )
          .subscribe()
      }

      // Limpiar la suscripción al desmontar
      return () => {
        console.log('Limpiando suscripción de aprobaciones')
        if (reservasPendientesSubscription) {
          supabase.removeChannel(reservasPendientesSubscription)
        }
      }
    }
  }, [loadingSalas, salasResponsable, esAdmin, esSuperAdmin, adminSinSalas])

  // Mostrar spinner de carga solo durante la inicialización
  if (loadingSalas || !initialized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Cargando...</span>
        </div>
      </div>
    )
  }

  const handleCambioEstado = async (reservaId: string, nuevoEstado: 'aprobada' | 'rechazada', motivoRechazo?: string) => {
    try {
      // Verificar si el usuario tiene permiso para cambiar el estado de esta reserva
      const reserva = reservas.find(r => r.id === reservaId)
      
      if (!reserva) {
        toast({
          title: "Error",
          description: "No se encontró la reserva",
          variant: "destructive",
        })
        return
      }
      
      // Si es admin (no superadmin), verificar si es responsable de la sala
      if (esAdmin && !esSuperAdmin) {
        const tienePermiso = salasResponsable.some(sala => sala.id === reserva.sala.id)
        
        if (!tienePermiso) {
          toast({
            title: "Acceso denegado",
            description: "No tienes permiso para gestionar reservas de esta sala",
            variant: "destructive",
          })
          return
        }
      }

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
    // Validar que el motivo no esté vacío
    if (!motivoRechazo || motivoRechazo.trim() === '') {
      toast({
        title: "Error",
        description: "Por favor, ingresa un motivo para rechazar la reserva.",
        variant: "destructive",
      });
      return; // Detener si no hay motivo
    }
    
    if (reservaIdParaRechazar) {
      handleCambioEstado(reservaIdParaRechazar, 'rechazada', motivoRechazo)
      setDialogoRechazoAbierto(false)
      setReservaIdParaRechazar(null)
      setMotivoRechazo('')
    }
  }

  // Función para filtrar reservas según búsqueda y filtros
  const filtrarReservas = () => {
    return reservas.filter(reserva => {
      const cumpleFiltroSala = filtroSala === 'todas' || reserva.sala.id.toString() === filtroSala
      const cumpleBusqueda = 
        `${reserva.es_externo ? reserva.solicitante_nombre_completo : `${reserva.usuario.nombre} ${reserva.usuario.apellido}`} ${reserva.sala.nombre}`
          .toLowerCase()
          .includes(busqueda.toLowerCase())
      
      return cumpleFiltroSala && cumpleBusqueda
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Aprobación de Reservas</h1>
        {!adminSinSalas && (
          <Button
            variant="outline"
            onClick={() => setOrdenFecha(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            Ordenar por fecha {ordenFecha === 'asc' ? '↑' : '↓'}
          </Button>
        )}
      </div>

      {/* Mensaje específico para administradores sin salas asignadas */}
      {adminSinSalas ? (
        <Card className="my-8">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="bg-orange-100 p-3 rounded-full">
                <Info className="h-8 w-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-semibold">No tienes salas asignadas</h2>
              <p className="text-muted-foreground max-w-md">
                No eres responsable de ninguna sala, por lo que no puedes ver ni gestionar 
                reservas para aprobación. Contacta al administrador del sistema para que te asigne salas.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {esAdmin && !esSuperAdmin && (
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertTitle>Acceso limitado</AlertTitle>
              <AlertDescription>
                Solo puedes gestionar reservas de las salas de las que eres responsable ({salasResponsable.length} salas).
              </AlertDescription>
            </Alert>
          )}

          {/* Mostrar controles de filtro solo si el usuario tiene acceso a reservas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label>Buscar</Label>
              <Input
                placeholder="Buscar por usuario o sala..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div>
              <Label>Filtrar por sala</Label>
              <Select value={filtroSala} onValueChange={setFiltroSala}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione sala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las salas</SelectItem>
                  {salas.map((sala) => (
                    <SelectItem key={sala.id} value={sala.id.toString()}>
                      {sala.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 mt-6">
            {/* Encabezado de la lista */}
            <div className="hidden md:flex items-center px-3 py-2 bg-muted text-sm font-medium text-muted-foreground rounded-md">
              <div className="flex-1 px-3">Solicitante</div>
              <div className="w-48 px-3">Sala</div>
              <div className="w-48 px-3">Fecha y Hora</div>
              <div className="w-28 px-3">Estado</div>
              <div className="w-[176px] px-3 text-center">Acciones</div>
            </div>
            
            {loadingSalas ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filtrarReservas().length === 0 ? (
              <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-muted">
                <p className="text-muted-foreground">No hay reservas pendientes de aprobación</p>
              </div>
            ) : (
              filtrarReservas().map((reserva) => (
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
                      <div className="w-[176px] p-3 border-l border-border">
                        <div className="flex gap-2 justify-center">
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
                            <p className="text-xs text-muted-foreground line-clamp-1 flex-1">{reserva.comentario}</p>
                          )}
                          
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
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
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
              disabled={!motivoRechazo || motivoRechazo.trim() === ''} // Deshabilitar si no hay motivo
            >
              Rechazar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

