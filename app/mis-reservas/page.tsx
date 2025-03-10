"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'
import { Calendar } from "@/components/ui/calendar"
import { useReservasData } from '@/hooks/useReservasData'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useUserReservas } from '@/hooks/useUserReservas'
import { DisponibilidadModal } from "@/components/ui/disponibilidad-modal"

interface HorarioOcupado {
  hora_inicio: string;
  hora_fin: string;
}

interface NuevaReserva {
  sala: string | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  esUrgente: boolean;
  esExterno: boolean;
  solicitanteNombreCompleto: string;
  institucion: string;
  mailExternos: string;
  telefono: string;
  comentario: string;
}

interface ReservaResponse {
  // ... otros campos ...
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
}

export default function MisReservas() {
  const { reservas, loading, error, fetchUserReservas: fetchReservas } = useUserReservas()
  const { fetchHorariosOcupados, horariosOcupados, salas, loadingSalas } = useReservasData()
  const [nuevaReserva, setNuevaReserva] = useState<NuevaReserva>({
    sala: null,
    fecha: '',
    horaInicio: '',
    horaFin: '',
    esUrgente: false,
    esExterno: false,
    solicitanteNombreCompleto: '',
    institucion: '',
    mailExternos: '',
    telefono: '',
    comentario: ''
  })
  const [selectedSala, setSelectedSala] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const { user } = useUser()
  const [conflictoHorario, setConflictoHorario] = useState<boolean>(false)
  const [mensajeConflicto, setMensajeConflicto] = useState<string>('')

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
    }
  }, [error])

  useEffect(() => {
    if (selectedSala && selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      fetchHorariosOcupados(Number(selectedSala), formattedDate)
    }
  }, [selectedSala, selectedDate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNuevaReserva(prev => ({ ...prev, [name]: value }))
    
    if (name === 'fecha' && nuevaReserva.sala) {
      fetchHorariosOcupados(Number(nuevaReserva.sala), value)
      // Resetear el estado de conflicto al cambiar la fecha
      setConflictoHorario(false)
      setMensajeConflicto('')
    }
    
    // Validar superposición de horarios cuando cambian las horas
    if ((name === 'horaInicio' || name === 'horaFin') && 
        nuevaReserva.sala && 
        nuevaReserva.fecha && 
        nuevaReserva.horaInicio && 
        nuevaReserva.horaFin) {
      
      const horaInicio = name === 'horaInicio' ? value : nuevaReserva.horaInicio
      const horaFin = name === 'horaFin' ? value : nuevaReserva.horaFin
      
      // Validar que la hora de fin sea posterior a la de inicio
      const inicio = new Date(`2000-01-01T${horaInicio}`)
      const fin = new Date(`2000-01-01T${horaFin}`)
      
      if (fin <= inicio) {
        setConflictoHorario(true)
        setMensajeConflicto('La hora de fin debe ser posterior a la hora de inicio')
        return
      }
      
      // Validar superposición con horarios ocupados
      let hayConflicto = false
      let horarioConflicto = ''
      
      for (const horario of horariosOcupados) {
        const horarioInicio = new Date(`2000-01-01T${horario.hora_inicio}`)
        const horarioFin = new Date(`2000-01-01T${horario.hora_fin}`)
        
        if ((inicio >= horarioInicio && inicio < horarioFin) ||
            (fin > horarioInicio && fin <= horarioFin) ||
            (inicio <= horarioInicio && fin >= horarioFin)) {
          hayConflicto = true
          horarioConflicto = `${horario.hora_inicio} - ${horario.hora_fin}`
          break
        }
      }
      
      if (hayConflicto) {
        setConflictoHorario(true)
        setMensajeConflicto(`El horario seleccionado se superpone con una reserva existente (${horarioConflicto})`)
      } else {
        setConflictoHorario(false)
        setMensajeConflicto('')
      }
    }
  }

  const handleSelectChange = (value: string) => {
    setNuevaReserva(prev => ({ ...prev, sala: value }))
    if (nuevaReserva.fecha) {
      fetchHorariosOcupados(Number(value), nuevaReserva.fecha)
      // Resetear el estado de conflicto al cambiar la sala
      setConflictoHorario(false)
      setMensajeConflicto('')
    }
  }

  const handleCheckboxChange = (checked: boolean) => {
    setNuevaReserva(prev => ({ ...prev, esUrgente: checked }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setNuevaReserva(prev => ({ ...prev, esExterno: checked }))
  }

  const handleDisponibilidadDateSelect = (date: Date) => {
    setSelectedDate(date)
    setNuevaReserva(prev => ({ 
      ...prev, 
      fecha: format(date, 'yyyy-MM-dd') 
    }))
    
    if (nuevaReserva.sala) {
      fetchHorariosOcupados(Number(nuevaReserva.sala), format(date, 'yyyy-MM-dd'))
    }
  }

  const validateReservation = () => {
    if (!nuevaReserva.horaInicio || !nuevaReserva.horaFin) return false

    const inicio = new Date(`2000-01-01T${nuevaReserva.horaInicio}`)
    const fin = new Date(`2000-01-01T${nuevaReserva.horaFin}`)

    if (fin <= inicio) {
      toast({
        title: "Error",
        description: "La hora de fin debe ser posterior a la hora de inicio",
        variant: "destructive",
      })
      return false
    }

    for (const horario of horariosOcupados) {
      const horarioInicio = new Date(`2000-01-01T${horario.hora_inicio}`)
      const horarioFin = new Date(`2000-01-01T${horario.hora_fin}`)

      if ((inicio >= horarioInicio && inicio < horarioFin) ||
          (fin > horarioInicio && fin <= horarioFin) ||
          (inicio <= horarioInicio && fin >= horarioFin)) {
        toast({
          title: "Error",
          description: `El horario seleccionado se superpone con una reserva existente (${horario.hora_inicio} - ${horario.hora_fin})`,
          variant: "destructive"
        })
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar campos requeridos
    if (!nuevaReserva.sala || !nuevaReserva.fecha || !nuevaReserva.horaInicio || !nuevaReserva.horaFin) {
      toast({
        title: "Error",
        description: "Todos los campos son requeridos",
        variant: "destructive",
      })
      return
    }

    // Validar campos adicionales para reserva externa
    if (nuevaReserva.esExterno) {
      if (!nuevaReserva.solicitanteNombreCompleto || !nuevaReserva.institucion || !nuevaReserva.mailExternos) {
        toast({
          title: "Error",
          description: "Para reservas externas, el nombre completo, institución y email son obligatorios",
          variant: "destructive",
        })
        return
      }
    }

    // Validar superposición de horarios
    if (!validateReservation()) {
      return // validateReservation ya muestra el toast de error
    }

    try {
      const reservaData = {
        sala_id: parseInt(nuevaReserva.sala),
        usuario_id: user?.id,
        fecha: nuevaReserva.fecha,
        hora_inicio: nuevaReserva.horaInicio,
        hora_fin: nuevaReserva.horaFin,
        es_urgente: nuevaReserva.esUrgente,
        estado: 'pendiente', // Estado inicial siempre pendiente
        es_externo: nuevaReserva.esExterno,
        solicitante_nombre_completo: nuevaReserva.esExterno ? nuevaReserva.solicitanteNombreCompleto : null,
        institucion: nuevaReserva.esExterno ? nuevaReserva.institucion : null,
        mail_externos: nuevaReserva.esExterno ? nuevaReserva.mailExternos : null,
        telefono: nuevaReserva.esExterno ? nuevaReserva.telefono : null,
        comentario: nuevaReserva.comentario || null
      }

      const { error } = await supabase
        .from('reservas')
        .insert(reservaData)

      if (error) throw error

      toast({
        title: "Reserva enviada",
        description: "Tu reserva ha sido creada y está pendiente de aprobación",
      })

      // Resetear el formulario
      setNuevaReserva({
        sala: null,
        fecha: '',
        horaInicio: '',
        horaFin: '',
        esUrgente: false,
        esExterno: false,
        solicitanteNombreCompleto: '',
        institucion: '',
        mailExternos: '',
        telefono: '',
        comentario: ''
      })

      // Actualizar las listas
      fetchReservas()
      if (selectedSala && selectedDate) {
        fetchHorariosOcupados(Number(selectedSala), format(selectedDate, 'yyyy-MM-dd'))
      }
    } catch (error) {
      console.error('Error al crear la reserva:', error)
      toast({
        title: "Error",
        description: "No se pudo crear la reserva. Por favor, intenta nuevamente.",
        variant: "destructive",
      })
    }
  }

  const handleCancelar = async (id: number) => {
    try {
      const { error } = await supabase
        .from('reservas')
        .update({ estado: 'cancelada' })
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Reserva cancelada",
        description: "La reserva ha sido cancelada exitosamente",
      })

      fetchReservas()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "No se pudo cancelar la reserva",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Mis Reservas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Nueva Reserva</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch 
                  id="reservaExterna"
                  checked={nuevaReserva.esExterno}
                  onCheckedChange={handleSwitchChange}
                />
                <Label htmlFor="reservaExterna">Reserva Externa</Label>
              </div>

              {nuevaReserva.esExterno && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                  <div>
                    <Label htmlFor="solicitanteNombreCompleto">Nombre Completo</Label>
                    <Input 
                      id="solicitanteNombreCompleto" 
                      name="solicitanteNombreCompleto" 
                      value={nuevaReserva.solicitanteNombreCompleto} 
                      onChange={handleInputChange} 
                      placeholder="Nombre completo del solicitante externo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="institucion">Institución</Label>
                    <Input 
                      id="institucion" 
                      name="institucion" 
                      value={nuevaReserva.institucion} 
                      onChange={handleInputChange} 
                      placeholder="Nombre de la institución"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailExternos">Email</Label>
                    <Input 
                      id="mailExternos" 
                      name="mailExternos" 
                      type="email" 
                      value={nuevaReserva.mailExternos} 
                      onChange={handleInputChange} 
                      placeholder="Email de contacto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefono">Teléfono (opcional)</Label>
                    <Input 
                      id="telefono" 
                      name="telefono" 
                      value={nuevaReserva.telefono} 
                      onChange={handleInputChange} 
                      placeholder="Teléfono de contacto"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="sala">Sala</Label>
                <Select 
                  onValueChange={handleSelectChange} 
                  value={nuevaReserva.sala || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSalas ? "Cargando salas..." : "Seleccione una sala"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingSalas ? (
                      <SelectItem value="loading">Cargando...</SelectItem>
                    ) : salas.length > 0 ? (
                      salas.map((sala) => (
                        <SelectItem key={sala.id} value={sala.id.toString()}>
                          {sala.nombre}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-salas">No hay salas disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                {/* Información detallada de la sala seleccionada */}
                {nuevaReserva.sala && (
                  <div className="mt-2 rounded-lg border border-border p-4 bg-muted/10">
                    {(() => {
                      const salaSeleccionada = salas.find(s => s.id.toString() === nuevaReserva.sala);
                      if (!salaSeleccionada) return null;
                      
                      return (
                        <>
                          <div className="flex items-center gap-2 mb-3 border-b pb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary">
                              <path fillRule="evenodd" d="M4.5 2.25a.75.75 0 0 0-.75.75v13.5a.75.75 0 0 0 1.5 0V3a.75.75 0 0 0-.75-.75Zm6.75 1.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM4.5 6.75a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V7.5a.75.75 0 0 0-.75-.75Zm6.75 1.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM4.5 11.25a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Zm6.75 1.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM4.5 15.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" />
                            </svg>
                            <h3 className="font-semibold text-lg">{salaSeleccionada.nombre}</h3>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-muted-foreground">
                                <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
                              </svg>
                              <span className="text-sm">
                                <span className="font-medium">Capacidad:</span> {salaSeleccionada.capacidad} personas
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-muted-foreground">
                                <path fillRule="evenodd" d="M11.54 22.351.07 9.331a.5.5 0 0 1 .353-.853h15.485a.5.5 0 0 1 .354.854l-4.718 5.19 3.5 7.5a.5.5 0 0 1-.868.496l-2.635-3.187Z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm">
                                <span className="font-medium">Tipo:</span> {salaSeleccionada.tipo}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 col-span-2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-muted-foreground">
                                <path fillRule="evenodd" d="M11.097 1.515a.75.75 0 0 1 .589.882L10.666 7.5h4.47l1.079-5.397a.75.75 0 1 1 1.47.294L16.665 7.5h3.585a.75.75 0 0 1 0 1.5h-3.885l-1.2 6h3.585a.75.75 0 0 1 0 1.5h-3.885l-1.08 5.397a.75.75 0 1 1-1.47-.294l1.02-5.103h-4.47l-1.08 5.397a.75.75 0 1 1-1.47-.294l1.02-5.103H3.75a.75.75 0 0 1 0-1.5h3.885l1.2-6H5.25a.75.75 0 0 1 0-1.5h3.885l1.08-5.397a.75.75 0 0 1 .882-.588ZM10.365 9l-1.2 6h4.47l1.2-6h-4.47Z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm">
                                <span className="font-medium">Centro:</span> {salaSeleccionada.centro || "No especificado"}
                              </span>
                            </div>
                          </div>
                          
                          {salaSeleccionada.descripcion && (
                            <div className="mb-4 p-3 bg-muted/20 rounded border border-border">
                              <div className="flex items-center gap-1.5 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-primary">
                                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Descripción y equipamiento:</span>
                              </div>
                              <p className="text-sm text-muted-foreground ml-6">{salaSeleccionada.descripcion}</p>
                            </div>
                          )}
                          
                          {/* Botón de Ver disponibilidad dentro del cuadro */}
                          <div className="flex justify-center">
                            <DisponibilidadModal 
                              salaId={Number(salaSeleccionada.id)}
                              salaName={salaSeleccionada.nombre}
                              onDateSelect={handleDisponibilidadDateSelect}
                              disabled={false}
                              buttonClassName="w-full"
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="fecha">Fecha</Label>
                <Input id="fecha" name="fecha" type="date" value={nuevaReserva.fecha} onChange={handleInputChange} />
              </div>
              {nuevaReserva.sala && nuevaReserva.fecha && (
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
                            <span className="font-medium">{horario.hora_inicio}</span>
                            <span className="mx-2">-</span>
                            <span className="font-medium">{horario.hora_fin}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay horarios ocupados para esta fecha</p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="horaInicio">Hora de Inicio</Label>
                <Input 
                  id="horaInicio" 
                  name="horaInicio" 
                  type="time" 
                  value={nuevaReserva.horaInicio} 
                  onChange={handleInputChange}
                  className={conflictoHorario ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
              <div>
                <Label htmlFor="horaFin">Hora de Fin</Label>
                <Input 
                  id="horaFin" 
                  name="horaFin" 
                  type="time" 
                  value={nuevaReserva.horaFin} 
                  onChange={handleInputChange}
                  className={conflictoHorario ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
              </div>
              
              {conflictoHorario && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Conflicto de horario:</span>
                  </div>
                  <p className="mt-1 ml-7">{mensajeConflicto}</p>
                </div>
              )}

              <div>
                <Label htmlFor="comentario">Comentario (opcional)</Label>
                <Textarea 
                  id="comentario" 
                  name="comentario" 
                  value={nuevaReserva.comentario} 
                  onChange={handleInputChange} 
                  placeholder="Agregue un comentario o descripción para la reserva"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="urgente" 
                  checked={nuevaReserva.esUrgente}
                  onCheckedChange={handleCheckboxChange}
                />
                <Label htmlFor="urgente">Reserva Urgente</Label>
              </div>
              <Button type="submit">Solicitar Reserva</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Historial de Reservas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Historial de Reservas</h2>
              
              {loading ? (
                <div className="text-center py-8">Cargando tus reservas...</div>
              ) : error ? (
                <div className="text-red-500 py-4">{error}</div>
              ) : reservas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tienes reservas registradas
                </div>
              ) : (
                <div className="space-y-4">
                  {reservas.map((reserva) => (
                    <Card key={reserva.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{reserva.sala.nombre}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(reserva.fecha).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm">
                              {reserva.hora_inicio.slice(0, 5)} - {reserva.hora_fin.slice(0, 5)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex gap-2">
                              {reserva.es_urgente && (
                                <span className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-1">
                                  Urgente
                                </span>
                              )}
                              <span className={`text-xs rounded-full px-2 py-1 ${
                                reserva.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                reserva.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {reserva.estado.charAt(0).toUpperCase() + reserva.estado.slice(1)}
                              </span>
                            </div>
                            {reserva.estado === 'pendiente' && (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleCancelar(reserva.id)}
                              >
                                Cancelar Reserva
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

