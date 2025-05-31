import { useState } from 'react'
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"

interface HorarioOcupado {
  horaInicio: string;
  horaFin: string;
}

interface ReservationCalendarProps {
  fecha: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  horariosOcupados: HorarioOcupado[];
}

export function ReservationCalendar({ fecha, onDateChange, horariosOcupados }: ReservationCalendarProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Calendar
          mode="single"
          selected={fecha}
          onSelect={onDateChange}
          className="rounded-md border"
        />
        {fecha && horariosOcupados.length > 0 && (
          <div className="p-4">
            <h3 className="font-semibold mb-2">Horarios Ocupados:</h3>
            <ul className="space-y-1">
              {horariosOcupados.map((horario, index) => (
                <li key={index} className="text-sm">
                  {horario.horaInicio} - {horario.horaFin}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
    )
}

Now, let's update the MisReservas component to use the new ReservationCalendar:

```typescriptreact file="app/mis-reservas/page.tsx"
[v0-no-op-code-block-prefix]"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'
import { ReservationCalendar } from "@/components/ReservationCalendar"

interface Reserva {
  id: number;
  sala: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'Pendiente' | 'Aprobada' | 'Rechazada';
}

export default function MisReservas() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [nuevaReserva, setNuevaReserva] = useState({
    sala: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    esUrgente: false
  })
  const [horariosOcupados, setHorariosOcupados] = useState<string[]>([]);
  const { user } = useUser()

  useEffect(() => {
    if (user) {
      fetchReservas()
    }
  }, [user])

  const fetchReservas = async () => {
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select(`
          id,
          sala:salas(nombre),
          fecha,
          hora_inicio,
          hora_fin,
          estado
        `)
        .eq('usuario_id', user?.id)
        .order('fecha', { ascending: false })

      if (error) throw error

      setReservas(data.map(r => ({
        id: r.id,
        sala: r.sala.nombre,
        fecha: r.fecha,
        horaInicio: r.hora_inicio,
        horaFin: r.hora_fin,
        estado: r.estado
      })))
    } catch (error) {
      console.error('Error fetching reservas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas",
        variant: "destructive",
      })
    }
  }

  const fetchHorariosOcupados = async (salaId: string, fecha: string) => {
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select('hora_inicio')
        .eq('sala_id', salaId)
        .eq('fecha', fecha);

      if (error) throw error;

      setHorariosOcupados(data.map(r => r.hora_inicio));
    } catch (error) {
      console.error("Error fetching horarios ocupados:", error);
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNuevaReserva(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string) => {
    setNuevaReserva(prev => ({ ...prev, sala: value }))
    if (nuevaReserva.fecha) {
      fetchHorariosOcupados(value, nuevaReserva.fecha);
    }
  }

  const handleCheckboxChange = (checked: boolean) => {
    setNuevaReserva(prev => ({ ...prev, esUrgente: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaReserva.sala || !nuevaReserva.fecha || !nuevaReserva.horaInicio || !nuevaReserva.horaFin) {
      toast({
        title: "Error",
        description: "Por favor, complete todos los campos",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from('reservas')
        .insert([
          {
            usuario_id: user?.id,
            sala_id: nuevaReserva.sala,
            fecha: nuevaReserva.fecha,
            hora_inicio: nuevaReserva.horaInicio,
            hora_fin: nuevaReserva.horaFin,
            es_urgente: nuevaReserva.esUrgente,
            estado: 'Pendiente'
          }
        ])
        .select()

      if (error) throw error

      toast({
        title: "Reserva creada",
        description: "Su reserva ha sido creada y está pendiente de aprobación",
      })

      setNuevaReserva({
        sala: '',
        fecha: '',
        horaInicio: '',
        horaFin: '',
        esUrgente: false
      })

      fetchReservas()
    } catch (error) {
      console.error('Error creating reserva:', error)
      toast({
        title: "Error",
        description: "No se pudo crear la reserva",
        variant: "destructive",
      })
    }
  }

  const handleCancelar = async (id: number) => {
    try {
      const { error } = await supabase
        .from('reservas')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Reserva cancelada",
        description: "La reserva ha sido cancelada exitosamente",
      })

      fetchReservas()
    } catch (error) {
      console.error('Error canceling reserva:', error)
      toast({
        title: "Error",
        description: "No se pudo cancelar la reserva",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Mis Reservas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Nueva Reserva</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sala">Sala</Label>
                <Select onValueChange={handleSelectChange} value={nuevaReserva.sala}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sala A</SelectItem>
                    <SelectItem value="2">Auditorio Principal</SelectItem>
                    <SelectItem value="3">Sala de Reuniones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fecha">Fecha</Label>
                <ReservationCalendar
                  fecha={nuevaReserva.fecha ? new Date(nuevaReserva.fecha) : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      const formattedDate = date.toISOString().split('T')[0]
                      setNuevaReserva(prev => ({ ...prev, fecha: formattedDate }))
                      if (nuevaReserva.sala) {
                        fetchHorariosOcupados(nuevaReserva.sala, formattedDate)
                      }
                    }
                  }}
                  horariosOcupados={horariosOcupados}
                />
              </div>
              <div>
                <Label htmlFor="horaInicio">Hora de Inicio</Label>
                <Input id="horaInicio" name="horaInicio" type="time" value={nuevaReserva.horaInicio} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="horaFin">Hora de Fin</Label>
                <Input id="horaFin" name="horaFin" type="time" value={nuevaReserva.horaFin} onChange={handleInputChange} />
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
            <ul className="space-y-4">
              {reservas.map((reserva) => (
                <li key={reserva.id} className="bg-gray-100 p-4 rounded-md">
                  <p className="font-semibold">{reserva.sala}</p>
                  <p>{reserva.fecha} | {reserva.horaInicio} - {reserva.horaFin}</p>
                  <p className={`mt-2 ${
                    reserva.estado === 'Aprobada' ? 'text-green-600' :
                    reserva.estado === 'Rechazada' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    Estado: {reserva.estado}
                  </p>
                  {reserva.estado === 'Pendiente' && (
                    <Button variant="destructive" size="sm" className="mt-2" onClick={() => handleCancelar(reserva.id)}>
                      Cancelar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

