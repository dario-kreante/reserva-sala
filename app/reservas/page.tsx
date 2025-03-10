"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/ui/combobox"
import { UserSelect } from "@/components/ui/user-select"
import { useReservasData } from '@/hooks/useReservasData'
import { format } from 'date-fns'
import { useResponsableSalas } from '@/hooks/useResponsableSalas'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

  // Estado para el diálogo de rechazo con comentario
  const [dialogoRechazoAbierto, setDialogoRechazoAbierto] = useState(false)
  const [reservaIdParaRechazar, setReservaIdParaRechazar] = useState<string | null>(null)
  const [comentarioRechazo, setComentarioRechazo] = useState('')

  const fetchUsuarios = async () => {
    if (usuarios.length > 0) return;
    
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
    }
  }

  const fetchReservas = async () => {
    const today = new Date().toISOString().split('T')[0]
    const SISTEMA_UUID = '4a8794b5-139a-4d5d-a9da-dc2873665ca9'
    
    try {
      // Reservas actuales y futuras
      let queryActuales = supabase
        .from('reservas')
        .select(`
          *,
          sala:salas(id, nombre),
          usuario:usuarios(id, nombre, apellido, email, rol)
        `)
        .gte('fecha', today)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })

      // Si el usuario es admin y no superadmin, filtrar por las salas de las que es responsable
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        const salaIds = salasResponsable.map(sala => sala.id)
        queryActuales = queryActuales.in('sala_id', salaIds)
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
          sala:salas(id, nombre),
          usuario:usuarios(id, nombre, apellido, email, rol)
        `)
        .lt('fecha', today)
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: true })

      // Si el usuario es admin y no superadmin, filtrar por las salas de las que es responsable
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        const salaIds = salasResponsable.map(sala => sala.id)
        queryHistoricas = queryHistoricas.in('sala_id', salaIds)
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
      // Usar las salas de las que el usuario es responsable
      if (!loadingSalasResponsable) {
        console.log(`Usando ${salasResponsable.length} salas responsables`);
        setSalasLocales(salasResponsable)
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
      // Primero cargar las salas, que es lo más rápido
      fetchSalas();
      
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
  }, [loadingSalasResponsable]);

  // Añadir un nuevo useEffect para manejar el cambio en salasResponsable
  useEffect(() => {
    if (salasResponsable.length > 0 && !loadingSalasResponsable) {
      // Actualizar las salas locales cuando cambian las salas responsables
      setSalasLocales(salasResponsable);
      console.log(`Salas responsables actualizadas: ${salasResponsable.length} salas`);
    }
  }, [salasResponsable, loadingSalasResponsable]);

  useEffect(() => {
    if (selectedSala && selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      fetchHorariosOcupados(Number(selectedSala), formattedDate)
    }
  }, [selectedSala, selectedDate])

  const USUARIO_EXTERNO_ID = '14ed3494-2f73-4db6-970d-3026d2c59541'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('reservas')
        .insert({
          ...nuevaReserva,
          usuario_id: nuevaReserva.es_externo ? USUARIO_EXTERNO_ID : nuevaReserva.usuario_id,
          estado: 'pendiente'
        })
        .single()

      if (error) throw error

      toast({
        title: "Reserva creada",
        description: "La reserva ha sido creada exitosamente",
      })

      // Limpiar formulario
      setNuevaReserva({
        usuario_id: '',
        sala_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        estado: 'pendiente',
        es_urgente: false,
        es_externo: false
      })

    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "No se pudo crear la reserva",
        variant: "destructive",
      })
    }
  }

  const usuariosFiltrados = usuarios.filter(usuario => 
    `${usuario.nombre} ${usuario.apellido} ${usuario.rol}`
      .toLowerCase()
      .includes(busquedaUsuario.toLowerCase())
  )

  const handleCambioEstado = async (reservaId: string, nuevoEstado: 'aprobada' | 'rechazada', comentario?: string) => {
    try {
      const updateData: any = { estado: nuevoEstado }
      
      // Si hay comentario, añadirlo a los datos de actualización
      if (comentario && nuevoEstado === 'rechazada') {
        updateData.comentario = comentario
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
    setComentarioRechazo('')
    setDialogoRechazoAbierto(true)
  }

  // Función para confirmar el rechazo con comentario
  const confirmarRechazo = () => {
    if (reservaIdParaRechazar) {
      handleCambioEstado(reservaIdParaRechazar, 'rechazada', comentarioRechazo)
      setDialogoRechazoAbierto(false)
      setReservaIdParaRechazar(null)
      setComentarioRechazo('')
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

  const validateReservation = () => {
    if (!nuevaReserva.hora_inicio || !nuevaReserva.hora_fin) return false

    const inicio = new Date(`2000-01-01T${nuevaReserva.hora_inicio}`)
    const fin = new Date(`2000-01-01T${nuevaReserva.hora_fin}`)

    if (fin <= inicio) {
      toast({
        title: "Error",
        description: "La hora de fin debe ser posterior a la hora de inicio",
        variant: "destructive",
      })
      return false
    }

    // Verificar superposición con horarios ocupados
    for (const horario of horariosOcupados) {
      const horarioInicio = new Date(`2000-01-01T${horario.hora_inicio}`)
      const horarioFin = new Date(`2000-01-01T${horario.hora_fin}`)

      if ((inicio >= horarioInicio && inicio < horarioFin) ||
          (fin > horarioInicio && fin <= horarioFin) ||
          (inicio <= horarioInicio && fin >= horarioFin)) {
        toast({
          title: "Error",
          description: "El horario seleccionado se superpone con una reserva existente",
          variant: "destructive",
        })
        return false
      }
    }

    return true
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
              <Label>Comentario (opcional)</Label>
              <Textarea
                value={nuevaReserva.comentario || ''}
                onChange={(e) => setNuevaReserva(prev => ({ 
                  ...prev, 
                  comentario: e.target.value 
                }))}
                placeholder="Agregue un comentario o descripción para la reserva"
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
                      if (nuevaReserva.fecha) {
                        fetchHorariosOcupados(Number(value), nuevaReserva.fecha)
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
                  type="date"
                  value={nuevaReserva.fecha}
                  onChange={(e) => {
                    console.log('Fecha seleccionada:', e.target.value) // Debug
                    const newDate = e.target.value
                    setNuevaReserva(prev => ({ ...prev, fecha: newDate }))
                    setSelectedDate(newDate ? new Date(newDate) : null)
                    if (nuevaReserva.sala_id) {
                      fetchHorariosOcupados(Number(nuevaReserva.sala_id), newDate)
                    }
                  }}
                  required
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
                            <span className="font-medium">{horario.hora_inicio.slice(0, 5)}</span>
                            <span className="mx-2">-</span>
                            <span className="font-medium">{horario.hora_fin.slice(0, 5)}</span>
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
                  />
                </div>
              </div>

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

      {esAdmin && !esSuperAdmin && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Acceso limitado</AlertTitle>
          <AlertDescription>
            Solo puedes gestionar reservas de las salas de las que eres responsable ({salasResponsable.length} salas).
          </AlertDescription>
        </Alert>
      )}

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
                      <p className="text-sm">{new Date(reserva.fecha).toLocaleDateString()}</p>
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
                          <p className="text-sm">{new Date(reserva.fecha).toLocaleDateString()}</p>
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
            <Button variant="destructive" onClick={confirmarRechazo}>
              Rechazar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

