"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { useResponsableSalas } from '@/hooks/useResponsableSalas'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

interface Horario {
  id: number
  sala_id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  recurrencia: string
  periodo_id: number
  sala: {
    nombre: string
  }
  periodo: {
    nombre: string
  }
}

interface Sala {
  id: number
  nombre: string
}

interface Periodo {
  id: number
  nombre: string
  fecha_inicio: string
  fecha_fin: string
}

const tiposRecurrencia = [
  { value: 'unico', label: 'Único' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' }
]

// Primero, agreguemos un objeto para mapear los valores de recurrencia a etiquetas más amigables
const recurrenciaLabels = {
  unico: 'Único',
  semanal: 'Semanal',
  mensual: 'Mensual'
} as const

export default function GestionHorarios() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nuevoHorario, setNuevoHorario] = useState({
    sala_id: '',
    periodo_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    recurrencia: '',
  })
  const [formValido, setFormValido] = useState(false)
  const { 
    salasResponsable, 
    loading: loadingSalas, 
    puedeVerTodo,
    esSuperAdmin,
    esAdmin
  } = useResponsableSalas()

  // Validar formulario
  useEffect(() => {
    const { sala_id, periodo_id, fecha, hora_inicio, hora_fin, recurrencia } = nuevoHorario
    setFormValido(
      Boolean(sala_id && periodo_id && fecha && hora_inicio && hora_fin && recurrencia)
    )
  }, [nuevoHorario])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Cargar horarios
      let query = supabase
        .from('horarios')
        .select(`
          *,
          sala:salas(nombre),
          periodo:periodos(nombre)
        `)
        .order('fecha')
      
      // Si el usuario es admin y no superadmin, filtrar por las salas de las que es responsable
      if (esAdmin && !esSuperAdmin && salasResponsable.length > 0) {
        const salaIds = salasResponsable.map(sala => sala.id)
        query = query.in('sala_id', salaIds)
      }

      const { data: horariosData, error: horariosError } = await query

      if (horariosError) throw horariosError

      // Usar las salas de las que el usuario es responsable
      setSalas(salasResponsable)

      // Cargar períodos activos
      const today = new Date().toISOString().split('T')[0]
      const { data: periodosData, error: periodosError } = await supabase
        .from('periodos')
        .select('*')
        .gte('fecha_fin', today)
        .order('fecha_inicio')

      if (periodosError) throw periodosError

      setHorarios(horariosData)
      setPeriodos(periodosData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loadingSalas) {
      fetchData()
    }
  }, [loadingSalas, salasResponsable])

  const verificarSuperposicion = async (sala_id: number, fecha: string, hora_inicio: string, hora_fin: string) => {
    const { data, error } = await supabase
      .from('horarios')
      .select('*')
      .eq('sala_id', sala_id)
      .eq('fecha', fecha)
      .or(`hora_inicio.lte.${hora_fin},hora_fin.gte.${hora_inicio}`)

    if (error) throw error

    return data.length > 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { sala_id, periodo_id, fecha, hora_inicio, hora_fin, recurrencia } = nuevoHorario
      
      // Verificar si el usuario tiene permiso para esta sala
      if (esAdmin && !esSuperAdmin) {
        const salaIdNum = parseInt(sala_id)
        const tienePermiso = salasResponsable.some(sala => sala.id === salaIdNum)
        
        if (!tienePermiso) {
          toast({
            title: "Acceso denegado",
            description: "No tienes permiso para gestionar horarios de esta sala",
            variant: "destructive",
          })
          return
        }
      }

      const horarioData = {
        sala_id: parseInt(sala_id),
        periodo_id: parseInt(periodo_id),
        fecha,
        hora_inicio,
        hora_fin,
        recurrencia
      }

      // Verificar superposición
      const haySuperposicion = await verificarSuperposicion(
        horarioData.sala_id,
        horarioData.fecha,
        horarioData.hora_inicio,
        horarioData.hora_fin
      )

      if (haySuperposicion) {
        toast({
          title: "Superposición detectada",
          description: "Ya existe un horario para esta sala en el mismo horario",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from('horarios')
        .insert([horarioData])

      if (error) throw error

      toast({
        title: "Horario creado",
        description: "El horario ha sido creado exitosamente",
      })

      setDialogOpen(false)
      setNuevoHorario({
        sala_id: '',
        periodo_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        recurrencia: '',
      })
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el horario",
        variant: "destructive",
      })
    }
  }

  const handleEliminar = async (id: number) => {
    try {
      // Verificar si el usuario tiene permiso para eliminar este horario
      const horario = horarios.find(h => h.id === id)
      
      if (!horario) {
        toast({
          title: "Error",
          description: "No se encontró el horario",
          variant: "destructive",
        })
        return
      }
      
      // Si es admin (no superadmin), verificar si es responsable de la sala
      if (esAdmin && !esSuperAdmin) {
        const tienePermiso = salasResponsable.some(sala => sala.id === horario.sala_id)
        
        if (!tienePermiso) {
          toast({
            title: "Acceso denegado",
            description: "No tienes permiso para eliminar horarios de esta sala",
            variant: "destructive",
          })
          return
        }
      }
      
      const { error } = await supabase
        .from('horarios')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Horario eliminado",
        description: "El horario ha sido eliminado exitosamente",
      })

      fetchData()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el horario",
        variant: "destructive",
      })
    }
  }

  if (loading || loadingSalas) {
    return <div className="container mx-auto px-4 py-8">Cargando...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Horarios</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Nuevo Horario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Horario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sala_id">Sala</Label>
                <Select 
                  value={nuevoHorario.sala_id} 
                  onValueChange={(value) => setNuevoHorario(prev => ({ ...prev, sala_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {salas.map((sala) => (
                      <SelectItem key={sala.id} value={sala.id.toString()}>
                        {sala.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="periodo_id">Período</Label>
                <Select 
                  value={nuevoHorario.periodo_id} 
                  onValueChange={(value) => setNuevoHorario(prev => ({ ...prev, periodo_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un período" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodos.map((periodo) => (
                      <SelectItem key={periodo.id} value={periodo.id.toString()}>
                        {periodo.nombre} ({periodo.fecha_inicio} a {periodo.fecha_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={nuevoHorario.fecha}
                  onChange={(e) => setNuevoHorario(prev => ({ ...prev, fecha: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hora_inicio">Hora de inicio</Label>
                  <Input
                    id="hora_inicio"
                    type="time"
                    value={nuevoHorario.hora_inicio}
                    onChange={(e) => setNuevoHorario(prev => ({ ...prev, hora_inicio: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="hora_fin">Hora de fin</Label>
                  <Input
                    id="hora_fin"
                    type="time"
                    value={nuevoHorario.hora_fin}
                    onChange={(e) => setNuevoHorario(prev => ({ ...prev, hora_fin: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="recurrencia">Recurrencia</Label>
                <Select 
                  value={nuevoHorario.recurrencia} 
                  onValueChange={(value) => setNuevoHorario(prev => ({ ...prev, recurrencia: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo de recurrencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposRecurrencia.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={!formValido}>Crear Horario</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {esAdmin && !esSuperAdmin && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Acceso limitado</AlertTitle>
          <AlertDescription>
            Solo puedes gestionar horarios de las salas de las que eres responsable ({salasResponsable.length} salas).
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {horarios.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay horarios registrados
          </div>
        ) : (
          horarios.map((horario) => (
            <Card key={horario.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{horario.sala.nombre}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(horario.fecha).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm">
                      {horario.hora_inicio.slice(0, 5)} - {horario.hora_fin.slice(0, 5)}
                    </p>
                    <p className="text-sm">
                      Período: {horario.periodo.nombre}
                    </p>
                    <p className="text-sm">
                      Recurrencia: {recurrenciaLabels[horario.recurrencia as keyof typeof recurrenciaLabels]}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleEliminar(horario.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

