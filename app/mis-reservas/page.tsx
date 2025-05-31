"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar as CalendarIcon, Info, AlertTriangle, Check } from "lucide-react"
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'
import { useReservasData } from '@/hooks/useReservasData'
import { useUserReservas } from '@/hooks/useUserReservas'
import { DisponibilidadModal } from "@/components/ui/disponibilidad-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

// Importar las funciones de validación
import { validarReserva, validarHorarioConsistente, hayConflictoHorario } from '../utils/horarioValidation'

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
  const { toast } = useToast()
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
  const [fechaInput, setFechaInput] = useState<string>('')
  const { user } = useUser()
  const [conflictoHorario, setConflictoHorario] = useState<boolean>(false)
  const [mensajeConflicto, setMensajeConflicto] = useState<string>('')
  const [mostrarAlertaExito, setMostrarAlertaExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Referencia para evitar la doble consulta en el primer renderizado
  const prevSelectedDate = useRef<string | null>(null);
  const prevSelectedSala = useRef<string | null>(null);
  
  // Función para limpiar el formulario
  const limpiarFormulario = () => {
    // Verificar si hay contenido en el formulario antes de limpiar
    const hayContenido = nuevaReserva.sala || 
                        nuevaReserva.fecha || 
                        nuevaReserva.horaInicio || 
                        nuevaReserva.horaFin || 
                        nuevaReserva.comentario?.trim() ||
                        nuevaReserva.solicitanteNombreCompleto ||
                        nuevaReserva.institucion ||
                        nuevaReserva.mailExternos ||
                        nuevaReserva.telefono;

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
    setSelectedSala(null)
    setSelectedDate(undefined)
    setFechaInput('')
    setConflictoHorario(false)
    setMensajeConflicto('')
    setMostrarAlertaExito(false)
    
    // Resetear las referencias
    prevSelectedDate.current = null
    prevSelectedSala.current = null
    
    // Mostrar mensaje de confirmación solo si había contenido
    if (hayContenido) {
      toast({
        title: "Formulario limpiado",
        description: "Todos los campos han sido restablecidos",
        variant: "default",
      })
    }
    
    console.log('✅ Formulario limpiado completamente')
  }
  
  // Creamos una función memoizada para fetchHorariosOcupados
  const fetchOcupados = useCallback(
    async (salaId: number, fechaStr: string, caller: string) => {
      console.log(`Consultando horarios ocupados: sala=${salaId}, fecha=${fechaStr}, origen=${caller}`);
      return fetchHorariosOcupados(salaId, fechaStr, caller);
    },
    [fetchHorariosOcupados]
  );
  
  // Modificamos el useEffect principal para usar el nuevo parámetro caller
  useEffect(() => {
    if (selectedSala && selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      
      // Verificar si es la misma consulta que ya hicimos
      const currentKey = `${selectedSala}-${formattedDate}`;
      const previousKey = `${prevSelectedSala.current}-${prevSelectedDate.current}`;
      
      if (currentKey !== previousKey) {
        console.log(`Llamando a fetchHorariosOcupados desde useEffect con salaId=${selectedSala} y fecha=${formattedDate}`);
        
        // Actualizamos las referencias para la próxima verificación
        prevSelectedSala.current = selectedSala;
        prevSelectedDate.current = formattedDate;
        
        // Realizamos la consulta
        fetchOcupados(Number(selectedSala), formattedDate, 'useEffect-principal');
      }
    }
  }, [selectedSala, selectedDate, fetchOcupados]);

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
    // Configurar suscripción en tiempo real para las reservas del usuario actual
    if (user && user.id) {
      console.log('Configurando suscripción en tiempo real para mis reservas...')
      
      // Suscribirse a las reservas del usuario actual
      const misReservasSubscription = supabase
        .channel('mis-reservas')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservas',
            filter: `usuario_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Cambio en mis reservas detectado:', payload)
            fetchReservas()
          }
        )
        .subscribe()

      // Limpiar la suscripción al desmontar
      return () => {
        console.log('Limpiando suscripción de mis reservas')
        supabase.removeChannel(misReservasSubscription)
      }
    }
  }, [user])

  // Agregar un efecto para validar los horarios cuando cambien
  useEffect(() => {
    // Solo validar si tenemos todos los datos necesarios
    if (nuevaReserva.sala && nuevaReserva.fecha && nuevaReserva.horaInicio && nuevaReserva.horaFin) {
      console.log('Validando horarios en tiempo real...');
      
      // Obtener la fecha y hora actual en Chile
      const fechaHoraChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
      
      // Crear fecha seleccionada con la hora actual
      const [year, month, day] = nuevaReserva.fecha.split('-').map(Number);
      const fechaSeleccionada = new Date(year, month - 1, day);
      
      // Si es el mismo día, validar que la hora no haya pasado
      if (fechaSeleccionada.getDate() === fechaHoraChile.getDate() &&
          fechaSeleccionada.getMonth() === fechaHoraChile.getMonth() &&
          fechaSeleccionada.getFullYear() === fechaHoraChile.getFullYear()) {
        
        const [horaInicio, minutoInicio] = nuevaReserva.horaInicio.split(':').map(Number);
        const horaInicioDate = new Date(year, month - 1, day, horaInicio, minutoInicio);
        
        if (horaInicioDate < fechaHoraChile) {
          setConflictoHorario(true);
          setMensajeConflicto('No se pueden realizar reservas en horarios pasados');
          return;
        }
      }
      
      // Validar si la fecha es pasada (días anteriores)
      fechaHoraChile.setHours(0, 0, 0, 0);
      fechaSeleccionada.setHours(0, 0, 0, 0);
      
      if (fechaSeleccionada < fechaHoraChile) {
        setConflictoHorario(true);
        setMensajeConflicto('No se pueden realizar reservas en fechas pasadas');
        return;
      }

      // Validar que la hora de fin sea posterior a la de inicio
      if (!validarHorarioConsistente(nuevaReserva.horaInicio, nuevaReserva.horaFin)) {
        setConflictoHorario(true);
        setMensajeConflicto('La hora de fin debe ser posterior a la hora de inicio');
        return;
      }
      
      // Si la fecha es válida y tenemos horarios ocupados, validar conflictos
      if (horariosOcupados.length > 0) {
        // Validar con la función compartida
        const resultadoValidacion = validarReserva(
          nuevaReserva.fecha,
          nuevaReserva.horaInicio,
          nuevaReserva.horaFin,
          horariosOcupados
        );
        
        if (!resultadoValidacion.esValida) {
          setConflictoHorario(true);
          setMensajeConflicto(resultadoValidacion.mensaje || 'Existe un conflicto con el horario seleccionado');
        } else {
          setConflictoHorario(false);
          setMensajeConflicto('');
        }
      }
    }
  }, [nuevaReserva.fecha, nuevaReserva.horaInicio, nuevaReserva.horaFin, horariosOcupados]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Si es el campo de fecha (ya sea DD/MM/YYYY o YYYY-MM-DD del input tipo date)
    if (name === 'fecha') {
      let newDate: Date | null = null;
      
      // Manejar formato DD/MM/YYYY (entrada manual)
      if (value.includes('/')) {
      setFechaInput(value);
      
      const [day, month, year] = value.split('/').map(Number);
      if (day && month && year) {
        try {
            newDate = new Date(year, month - 1, day);
          } catch (error) {
            console.error("Error al procesar la fecha manual:", error);
          }
        }
      }
      // Manejar formato YYYY-MM-DD (input tipo date)
      else if (value) {
        try {
          newDate = new Date(value + 'T00:00:00');
          setFechaInput(format(newDate, 'dd/MM/yyyy'));
        } catch (error) {
          console.error("Error al procesar la fecha del input:", error);
        }
      }
      
      // Si logramos crear una fecha válida
      if (newDate && isValid(newDate)) {
            // Validar que la fecha no sea en el pasado
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            
            if (newDate < hoy) {
              console.log('La fecha ingresada está en el pasado', newDate);
              toast({
                title: 'Fecha inválida',
                description: 'No se pueden realizar reservas en fechas pasadas',
                variant: 'destructive',
              });
              return;
            }
        
        console.log('✅ Nueva fecha seleccionada:', format(newDate, 'yyyy-MM-dd'));
            
            setSelectedDate(newDate);
            setNuevaReserva(prev => ({
              ...prev,
              fecha: format(newDate, 'yyyy-MM-dd'),
            }));
            
        // Limpiar estados de conflicto cuando cambia la fecha
        setConflictoHorario(false);
        setMensajeConflicto('');
        
        // Si tenemos sala seleccionada, consultamos horarios ocupados
            if (selectedSala) {
              const dateStr = format(newDate, 'yyyy-MM-dd');
          console.log('🔍 Actualizando horarios ocupados para nueva fecha:', dateStr);
          fetchOcupados(Number(selectedSala), dateStr, 'handleInputChange-fecha');
        } else {
          console.log('⚠️ No hay sala seleccionada para consultar horarios ocupados');
        }
      }
    } else {
      // Para cualquier otro campo, simplemente actualizar el estado
      setNuevaReserva(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSelectChange = (value: string) => {
    setSelectedSala(value);
    setNuevaReserva(prev => ({ ...prev, sala: value }));
    
    // Resetear el estado de conflicto al cambiar la sala
    setConflictoHorario(false);
    setMensajeConflicto('');
    
    if (value && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      // Llamamos a fetchOcupados con el origen identificado
      fetchOcupados(Number(value), dateStr, 'handleSelectChange');
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    setNuevaReserva(prev => ({ ...prev, esUrgente: checked }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setNuevaReserva(prev => ({ ...prev, esExterno: checked }))
  }

  const handleDisponibilidadDateSelect = (date: Date | undefined) => {
    if (!date) {
      console.log('No se seleccionó fecha');
      return;
    }

    // Validar que la fecha no sea en el pasado
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (date < hoy) {
      console.log('La fecha seleccionada está en el pasado', date);
      toast({
        title: 'Fecha inválida',
        description: 'No se pueden realizar reservas en fechas pasadas',
        variant: 'destructive',
      });
      return;
    }

    // Eliminar mensajes anteriores sobre fechas pasadas
    if (mensajeConflicto === 'No se pueden realizar reservas en fechas pasadas') {
      setMensajeConflicto('');
      setConflictoHorario(false);
    }

    // Formatear fecha como YYYY-MM-DD para la base de datos
    const fechaFormateada = format(date, 'yyyy-MM-dd');
    console.log('Fecha seleccionada formateada:', fechaFormateada);

    // Actualizar el estado y la fecha seleccionada en el calendario
    setSelectedDate(date);
    setFechaInput(format(date, 'dd/MM/yyyy'));
    setNuevaReserva(prev => ({
      ...prev,
      fecha: fechaFormateada,
    }));
    
    // Si tenemos sala seleccionada, consultamos ocupados
    if (selectedSala) {
      // Llamamos a fetchOcupados con el origen identificado
      fetchOcupados(Number(selectedSala), fechaFormateada, 'handleDisponibilidadDateSelect');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Iniciando creación de reserva...')
    
    try {
      // Verificar el comentario primero, antes que otros campos
      if (!nuevaReserva.comentario?.trim()) {
        console.log('Falta el comentario:', nuevaReserva)
        toast({
          title: "Campo requerido",
          description: "El comentario es obligatorio. Por favor, indica el motivo o detalles de la reserva.",
          variant: "destructive",
        })
        return
      }

      // Verificar otros campos obligatorios
      if (!nuevaReserva.sala || !nuevaReserva.fecha || !nuevaReserva.horaInicio || !nuevaReserva.horaFin) {
        console.log('Faltan campos obligatorios:', nuevaReserva)
        toast({
          title: "Error",
          description: "Debes completar todos los campos obligatorios",
          variant: "destructive",
        })
        return
      }
      
      if (!user && !nuevaReserva.esExterno) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión para realizar una reserva interna",
          variant: "destructive",
        })
        return;
      }
      
      if (nuevaReserva.esExterno && (!nuevaReserva.solicitanteNombreCompleto || !nuevaReserva.institucion || !nuevaReserva.mailExternos || !nuevaReserva.telefono)) {
        toast({
          title: "Error",
          description: "Para reservas externas, debes completar todos los datos del solicitante",
          variant: "destructive",
        })
        return;
      }
      
      if (conflictoHorario) {
        toast({
          title: "Error",
          description: mensajeConflicto || "Existe un conflicto con el horario seleccionado",
          variant: "destructive",
        })
        return;
      }
      
      // Antes de enviar, vamos a obtener los horarios ocupados actualizados
      if (selectedDate) {
        const fechaStr = format(selectedDate, 'yyyy-MM-dd');
        await fetchOcupados(Number(selectedSala), fechaStr, 'handleSubmit-preValidacion');
      }
      
      console.log('Preparando envío de la reserva...');
      
      // Validamos la reserva usando los horarios ocupados actuales
      console.log(`Validando reserva con ${horariosOcupados.length} horarios ocupados`);
      
      const horarios = horariosOcupados.map(h => ({
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin
      }));
      
      const resultadoValidacion = validarReserva(
        nuevaReserva.fecha,
        nuevaReserva.horaInicio,
        nuevaReserva.horaFin,
        horarios
      );
      
      if (!resultadoValidacion.esValida) {
        toast({
          title: "Error de validación",
          description: resultadoValidacion.mensaje,
          variant: "destructive",
        });
        
        if (resultadoValidacion.tipo === 'conflicto_horario') {
          setConflictoHorario(true);
          setMensajeConflicto(resultadoValidacion.mensaje || 'Hay un conflicto de horario');
        }
        
        return;
      }

      // Si es una reserva externa, validar datos adicionales
      if (nuevaReserva.esExterno && !nuevaReserva.institucion) {
        toast({
          title: "Error",
          description: "Para reservas externas, la institución es requerida",
          variant: "destructive",
        })
        return
      }
      
      // Preparar datos para enviar a la API
      const reservaData = {
        sala_id: Number(nuevaReserva.sala),
        fecha: nuevaReserva.fecha,
        hora_inicio: nuevaReserva.horaInicio,
        hora_fin: nuevaReserva.horaFin,
        estado: 'pendiente',
        es_urgente: nuevaReserva.esUrgente,
        comentario: nuevaReserva.comentario || '',
        es_externo: nuevaReserva.esExterno,
      }

      // Añadir campos adicionales si es una reserva externa
      if (nuevaReserva.esExterno) {
        Object.assign(reservaData, {
          solicitante_nombre_completo: nuevaReserva.solicitanteNombreCompleto,
          institucion: nuevaReserva.institucion,
          mail_externos: nuevaReserva.mailExternos,
          telefono: nuevaReserva.telefono
        })
      } else {
        // Si no es externa, asegurarse de que usuario_id esté establecido
        if (user?.id) {
          Object.assign(reservaData, {
            usuario_id: user.id
          })
        } else {
          toast({
            title: "Error",
            description: "No se pudo determinar el usuario actual",
            variant: "destructive",
          })
          return
        }
      }

      // Insertar la nueva reserva
      const { data, error } = await supabase
        .from('reservas')
        .insert(reservaData)
        .select()

      if (error) throw new Error(error.message)

      // Limpiar formulario y mostrar mensaje de éxito
      const nuevaReservaCreada = data[0]
      
      setMensajeExito(`Tu reserva ha sido creada exitosamente y está en estado ${nuevaReservaCreada.estado}.`)
      setMostrarAlertaExito(true)
      
      // Limpiar formulario usando la función dedicada
      limpiarFormulario()
      
      // Refrescar la lista de reservas
      fetchReservas()
    } catch (error) {
      console.error('Error:', error)
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
      
      {mostrarAlertaExito && (
        <Alert className="mb-6 bg-green-50 border-green-500 text-green-700">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-700 font-semibold">Reserva Exitosa</AlertTitle>
          <AlertDescription className="text-green-700">
            {mensajeExito}
          </AlertDescription>
        </Alert>
      )}
      
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
                <Input 
                  id="fecha" 
                  name="fecha" 
                  type="date" 
                  value={nuevaReserva.fecha} 
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              {nuevaReserva.sala && nuevaReserva.fecha && (
                <div className="rounded-lg border border-border p-4 bg-background">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <Label className="font-medium">Horarios Ocupados</Label>
                  </div>
                  {horariosOcupados.length > 0 ? (
                    <>
                      <Alert className="mb-3 bg-amber-50 border-amber-200 text-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Atención</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          No podrá reservar en los horarios que se superponen con los ya ocupados.
                          Por favor, seleccione un horario disponible.
                        </AlertDescription>
                      </Alert>
                      
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
                    </>
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
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error de horario</AlertTitle>
                  <AlertDescription>
                    {mensajeConflicto}
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="comentario">
                  Comentario <span className="text-red-500">*</span>
                  <span className="text-sm text-muted-foreground ml-1">(Obligatorio)</span>
                </Label>
                <Textarea
                  id="comentario"
                  name="comentario"
                  placeholder="Indica el motivo o detalles de la reserva (campo obligatorio)"
                  value={nuevaReserva.comentario}
                  onChange={handleInputChange}
                  className={`resize-none ${!nuevaReserva.comentario?.trim() ? 'border-red-200 focus:border-red-400' : ''}`}
                  required
                />
                {!nuevaReserva.comentario?.trim() && (
                  <p className="text-sm text-red-600 mt-1">
                    El comentario es obligatorio para procesar la reserva
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="urgente" 
                  checked={nuevaReserva.esUrgente}
                  onCheckedChange={handleCheckboxChange}
                />
                <Label htmlFor="urgente">Reserva Urgente</Label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={limpiarFormulario}
                  className="flex-1"
                >
                  Limpiar Formulario
                </Button>
                <Button 
                  type="submit" 
                  disabled={
                    !nuevaReserva.sala || 
                    !nuevaReserva.fecha || 
                    !nuevaReserva.horaInicio || 
                    !nuevaReserva.horaFin || 
                    !nuevaReserva.comentario?.trim() ||
                    conflictoHorario
                  }
                  className="flex-1"
                >
                  {(!nuevaReserva.sala || !nuevaReserva.fecha || !nuevaReserva.horaInicio || !nuevaReserva.horaFin) 
                    ? 'Completa todos los campos' 
                    : !nuevaReserva.comentario?.trim() 
                      ? 'Agrega un comentario' 
                      : conflictoHorario 
                        ? 'Resuelve conflicto de horario' 
                        : 'Solicitar Reserva'
                  }
                </Button>
              </div>
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
                              {(() => {
                                // Usar directamente la fecha correcta de la base de datos
                                const partesFecha = reserva.fecha.split('-');
                                // Crear fecha en hora local para evitar desplazamientos de zona horaria
                                const fecha = new Date(
                                  parseInt(partesFecha[0]), // año
                                  parseInt(partesFecha[1]) - 1, // mes (0-indexado)
                                  parseInt(partesFecha[2]) // día
                                );
                                return fecha.toLocaleDateString('es-ES', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                });
                              })()}
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

