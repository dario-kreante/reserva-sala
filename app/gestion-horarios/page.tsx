"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { useResponsableSalas } from '@/hooks/useResponsableSalas'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Calendar, Check, AlertTriangle, BookOpen, Users, GraduationCap } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

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
    // Campos descriptivos para reservas recurrentes
    nombre_modulo: '',
    seccion: '',
    codigo_asignatura: '',
    profesor_responsable: '',
    descripcion: '',
  })
  const [periodosSeleccionados, setPeriodosSeleccionados] = useState<string[]>([])
  const [creacionMultiple, setCreacionMultiple] = useState(false)
  const [formValido, setFormValido] = useState(false)
  const [mostrarAlertaExito, setMostrarAlertaExito] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const { 
    salasResponsable, 
    loading: loadingSalas, 
    puedeVerTodo,
    esSuperAdmin,
    esAdmin
  } = useResponsableSalas()

  // Validar formulario
  useEffect(() => {
    const { 
      sala_id, 
      fecha, 
      hora_inicio, 
      hora_fin, 
      recurrencia,
      nombre_modulo,
      codigo_asignatura,
      profesor_responsable
    } = nuevoHorario
    
    // Campos descriptivos obligatorios
    const camposDescriptivosValidos = Boolean(
      nombre_modulo.trim() && 
      codigo_asignatura.trim() && 
      profesor_responsable.trim()
    )
    
    // Si es creación múltiple, validar que haya periodos seleccionados
    if (creacionMultiple) {
      setFormValido(
        Boolean(
          sala_id && 
          fecha && 
          hora_inicio && 
          hora_fin && 
          recurrencia && 
          periodosSeleccionados.length > 0 &&
          camposDescriptivosValidos
        )
      )
    } else {
      // Validación original con campos descriptivos
      setFormValido(
        Boolean(
          sala_id && 
          nuevoHorario.periodo_id && 
          fecha && 
          hora_inicio && 
          hora_fin && 
          recurrencia &&
          camposDescriptivosValidos
        )
      )
    }
  }, [nuevoHorario, periodosSeleccionados, creacionMultiple])

  // Manejar la selección de múltiples periodos
  const handlePeriodoChange = (periodoId: string) => {
    setPeriodosSeleccionados(prev => {
      if (prev.includes(periodoId)) {
        return prev.filter(id => id !== periodoId)
      } else {
        return [...prev, periodoId]
      }
    })
  }

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
        .eq('activo', true)
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
      const { sala_id, fecha, hora_inicio, hora_fin, recurrencia } = nuevoHorario
      
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

      // Si es creación múltiple, procesar para cada periodo seleccionado
      if (creacionMultiple) {
        let errores = 0
        let exitosos = 0
        
        // Crear un array de promesas para insertar cada horario
        const promesas = periodosSeleccionados.map(async (periodoId) => {
          const horarioData = {
            sala_id: parseInt(sala_id),
            periodo_id: parseInt(periodoId),
            fecha,
            hora_inicio,
            hora_fin,
            recurrencia,
            // Campos descriptivos
            nombre_modulo: nuevoHorario.nombre_modulo,
            seccion: nuevoHorario.seccion,
            codigo_asignatura: nuevoHorario.codigo_asignatura,
            profesor_responsable: nuevoHorario.profesor_responsable,
            descripcion: nuevoHorario.descripcion,
            activo: true
          }
          
          // Verificar superposición
          const haySuperposicion = await verificarSuperposicion(
            horarioData.sala_id,
            horarioData.fecha,
            horarioData.hora_inicio,
            horarioData.hora_fin
          )
          
          if (haySuperposicion) {
            errores++
            return false
          }
          
          const { error } = await supabase
            .from('horarios')
            .insert([horarioData])
            
          if (error) {
            console.error(`Error al crear horario para periodo ${periodoId}:`, error)
            errores++
            return false
          } else {
            exitosos++
            return true
          }
        })
        
        // Esperar a que todas las promesas se completen
        await Promise.all(promesas)
        
        // Mostrar mensaje según los resultados
        if (exitosos > 0 && errores > 0) {
          toast({
            title: "Horarios creados parcialmente",
            description: `Se crearon ${exitosos} horarios, pero ${errores} fallaron debido a conflictos o superposiciones.`,
            variant: "default",
          })
          
          // Mostrar alerta de éxito parcial
          setMensajeExito(`Se crearon ${exitosos} horarios exitosamente, pero ${errores} fallaron debido a conflictos o superposiciones.`)
          setMostrarAlertaExito(true)
        } else if (exitosos > 0) {
          toast({
            title: "Horarios creados",
            description: `Se crearon ${exitosos} horarios exitosamente.`,
          })
          
          // Mostrar alerta de éxito
          setMensajeExito(`¡Se crearon ${exitosos} horarios exitosamente!`)
          setMostrarAlertaExito(true)
        } else {
          toast({
            title: "Error",
            description: "No se pudo crear ningún horario debido a conflictos o superposiciones.",
            variant: "destructive",
          })
        }
      } else {
        // Creación de un solo horario (código original)
        const horarioData = {
          sala_id: parseInt(sala_id),
          periodo_id: parseInt(nuevoHorario.periodo_id),
          fecha,
          hora_inicio,
          hora_fin,
          recurrencia,
          // Campos descriptivos
          nombre_modulo: nuevoHorario.nombre_modulo,
          seccion: nuevoHorario.seccion,
          codigo_asignatura: nuevoHorario.codigo_asignatura,
          profesor_responsable: nuevoHorario.profesor_responsable,
          descripcion: nuevoHorario.descripcion,
          activo: true
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
        
        // Mostrar alerta de éxito
        setMensajeExito("¡El horario ha sido creado exitosamente!")
        setMostrarAlertaExito(true)
      }
      
      // Ocultar la alerta después de 5 segundos
      setTimeout(() => {
        setMostrarAlertaExito(false)
      }, 5000)

      setDialogOpen(false)
      setNuevoHorario({
        sala_id: '',
        periodo_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        recurrencia: '',
        // Campos descriptivos para reservas recurrentes
        nombre_modulo: '',
        seccion: '',
        codigo_asignatura: '',
        profesor_responsable: '',
        descripcion: '',
      })
      setPeriodosSeleccionados([])
      setCreacionMultiple(false)
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              
              <div className="flex items-center space-x-2 my-4">
                <Checkbox 
                  id="creacion-multiple" 
                  checked={creacionMultiple}
                  onCheckedChange={(checked) => {
                    setCreacionMultiple(!!checked)
                    // Al activar la creación múltiple, limpiar el periodo_id individual
                    if (checked) {
                      setNuevoHorario(prev => ({ ...prev, periodo_id: '' }))
                    } else {
                      setPeriodosSeleccionados([])
                    }
                  }}
                />
                <Label htmlFor="creacion-multiple">Crear para múltiples periodos</Label>
              </div>
              
              {!creacionMultiple ? (
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
              ) : (
                <div>
                  <Label className="block mb-2">Periodos</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {periodos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay periodos disponibles</p>
                    ) : (
                      periodos.map((periodo) => (
                        <div key={periodo.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`periodo-${periodo.id}`}
                            checked={periodosSeleccionados.includes(periodo.id.toString())}
                            onCheckedChange={() => handlePeriodoChange(periodo.id.toString())}
                          />
                          <Label htmlFor={`periodo-${periodo.id}`} className="text-sm cursor-pointer">
                            {periodo.nombre} ({periodo.fecha_inicio} a {periodo.fecha_fin})
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  {periodosSeleccionados.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {periodosSeleccionados.length} periodos seleccionados
                    </p>
                  )}
                </div>
              )}
              
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
              
              {/* Sección de información académica */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4" />
                  <Label className="text-sm font-semibold">Información Académica</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="codigo_asignatura">Código Asignatura *</Label>
                    <Input
                      id="codigo_asignatura"
                      value={nuevoHorario.codigo_asignatura}
                      onChange={(e) => setNuevoHorario(prev => ({ ...prev, codigo_asignatura: e.target.value }))}
                      placeholder="ej: PSI101, MAT201"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seccion">Sección</Label>
                    <Input
                      id="seccion"
                      value={nuevoHorario.seccion}
                      onChange={(e) => setNuevoHorario(prev => ({ ...prev, seccion: e.target.value }))}
                      placeholder="ej: A, B, 01"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="nombre_modulo">Nombre del Módulo/Asignatura *</Label>
                  <Input
                    id="nombre_modulo"
                    value={nuevoHorario.nombre_modulo}
                    onChange={(e) => setNuevoHorario(prev => ({ ...prev, nombre_modulo: e.target.value }))}
                    placeholder="ej: Psicología General I, Estadística Aplicada"
                  />
                </div>
                
                <div>
                  <Label htmlFor="profesor_responsable">Profesor Responsable *</Label>
                  <Input
                    id="profesor_responsable"
                    value={nuevoHorario.profesor_responsable}
                    onChange={(e) => setNuevoHorario(prev => ({ ...prev, profesor_responsable: e.target.value }))}
                    placeholder="ej: Dr. María González, Prof. Juan Pérez"
                  />
                </div>
                
                <div>
                  <Label htmlFor="descripcion">Descripción Adicional</Label>
                  <Textarea
                    id="descripcion"
                    value={nuevoHorario.descripcion}
                    onChange={(e) => setNuevoHorario(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="ej: Cátedra teórica, Laboratorio práctico"
                    rows={2}
                  />
                </div>
              </div>
              
              {creacionMultiple && periodosSeleccionados.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-600">Creación múltiple</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Se crearán {periodosSeleccionados.length} horarios, uno para cada periodo seleccionado.
                  </AlertDescription>
                </Alert>
              )}
              
              <Button type="submit" disabled={!formValido} className="w-full">
                {creacionMultiple ? 'Crear Horarios' : 'Crear Horario'}
              </Button>
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
      
      {mostrarAlertaExito && (
        <Alert className="mb-6 bg-green-50 border-green-500 text-green-700">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-700 font-semibold">Operación Exitosa</AlertTitle>
          <AlertDescription className="text-green-700">
            {mensajeExito}
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
                      A partir del {(() => {
                        const [year, month, day] = horario.fecha.split('-');
                        const fecha = new Date(Number(year), Number(month) - 1, Number(day));
                        return fecha.toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        });
                      })()}
                    </p>
                    <p className="text-sm">
                      {horario.hora_inicio.slice(0, 5)} - {horario.hora_fin.slice(0, 5)}
                    </p>
                    <p className="text-sm">
                      Período: {horario.periodo.nombre}
                    </p>
                    <p className="text-sm">
                      Recurrencia: {recurrenciaLabels[horario.recurrencia as keyof typeof recurrenciaLabels]}
                      {horario.recurrencia === 'semanal' && (
                        <span> (se repite cada {(() => {
                          const [year, month, day] = horario.fecha.split('-');
                          const fecha = new Date(Number(year), Number(month) - 1, Number(day));
                          return fecha.toLocaleDateString('es-ES', { weekday: 'long' });
                        })()})</span>
                      )}
                      {horario.recurrencia === 'mensual' && (
                        <span> (se repite el día {horario.fecha.split('-')[2]} de cada mes)</span>
                      )}
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

