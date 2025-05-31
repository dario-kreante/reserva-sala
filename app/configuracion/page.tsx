"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Calendar as CalendarIcon, Plus, Info, Edit, Check, X, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Periodo {
  id: number
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}

export default function Configuracion() {
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogEditarOpen, setDialogEditarOpen] = useState(false)
  const [nuevoPeriodo, setNuevoPeriodo] = useState({
    nombre: '',
    fecha_inicio: '',
    fecha_fin: '',
    activo: true
  })
  const [periodoEditando, setPeriodoEditando] = useState<Periodo | null>(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [periodosInactivosConHorarios, setPeriodosInactivosConHorarios] = useState<number[]>([])
  const { user } = useUser()
  const router = useRouter()

  const fetchPeriodos = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('periodos')
        .select('*')
        .order('fecha_inicio', { ascending: false })
      
      // Si no se muestran inactivos, filtrar solo los activos
      if (!mostrarInactivos) {
        query = query.eq('activo', true)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      setPeriodos(data || [])

      // Verificar periodos inactivos con horarios asociados
      if (mostrarInactivos) {
        const periodosInactivos = data.filter(p => !p.activo).map(p => p.id)
        
        if (periodosInactivos.length > 0) {
          const { data: horarios, error: errorHorarios } = await supabase
            .from('horarios')
            .select('periodo_id')
            .in('periodo_id', periodosInactivos)
          
          if (!errorHorarios && horarios) {
            // Extraer IDs únicos de periodos con horarios
            const idsConHorarios = Array.from(new Set(horarios.map(h => h.periodo_id)))
            setPeriodosInactivosConHorarios(idsConHorarios)
          }
        } else {
          setPeriodosInactivosConHorarios([])
        }
      } else {
        setPeriodosInactivosConHorarios([])
      }
    } catch (error) {
      console.error('Error al cargar periodos:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los periodos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Protección para permitir acceso solo a superadmins
    if (user && user.rol !== 'superadmin') {
      router.push('/')
      return
    }
    
    fetchPeriodos()
  }, [user, router, mostrarInactivos])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNuevoPeriodo(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validarPeriodo = () => {
    // Validar que todos los campos estén completos
    if (!nuevoPeriodo.nombre || !nuevoPeriodo.fecha_inicio || !nuevoPeriodo.fecha_fin) {
      toast({
        title: "Datos incompletos",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      })
      return false
    }
    
    // Validar que la fecha de fin sea posterior a la de inicio
    if (nuevoPeriodo.fecha_inicio > nuevoPeriodo.fecha_fin) {
      toast({
        title: "Fechas inválidas",
        description: "La fecha de fin debe ser posterior a la fecha de inicio",
        variant: "destructive",
      })
      return false
    }
    
    return true
  }

  const crearPeriodo = async () => {
    if (!validarPeriodo()) return
    
    try {
      const { error } = await supabase
        .from('periodos')
        .insert([{
          nombre: nuevoPeriodo.nombre,
          fecha_inicio: nuevoPeriodo.fecha_inicio,
          fecha_fin: nuevoPeriodo.fecha_fin,
          activo: nuevoPeriodo.activo
        }])
      
      if (error) throw error
      
      toast({
        title: "Periodo creado",
        description: "El periodo se ha creado correctamente",
      })
      
      // Resetear formulario y cerrar dialog
      setNuevoPeriodo({
        nombre: '',
        fecha_inicio: '',
        fecha_fin: '',
        activo: true
      })
      setDialogOpen(false)
      
      // Recargar periodos
      fetchPeriodos()
    } catch (error) {
      console.error('Error al crear periodo:', error)
      toast({
        title: "Error",
        description: "No se pudo crear el periodo",
        variant: "destructive",
      })
    }
  }

  const toggleActivoPeriodo = async (id: number, estadoActual: boolean) => {
    try {
      const nuevoEstado = !estadoActual
      
      // Si estamos desactivando el periodo, pedir confirmación
      if (estadoActual) {
        // Verificar si hay horarios que usan este periodo
        const { data: horariosRelacionados, error: errorHorarios } = await supabase
          .from('horarios')
          .select('id')
          .eq('periodo_id', id)
        
        if (errorHorarios) throw errorHorarios
        
        if (horariosRelacionados && horariosRelacionados.length > 0) {
          const confirmar = window.confirm(
            `Este periodo está siendo utilizado en ${horariosRelacionados.length} horarios. ¿Está seguro de que desea desactivarlo? Los horarios asociados podrían verse afectados.`
          )
          
          if (!confirmar) {
            return
          }
        } else {
          const confirmar = window.confirm('¿Está seguro de que desea desactivar este periodo?')
          if (!confirmar) {
            return
          }
        }
      }
      
      const { error } = await supabase
        .from('periodos')
        .update({ activo: nuevoEstado })
        .eq('id', id)
      
      if (error) throw error
      
      toast({
        title: nuevoEstado ? "Periodo activado" : "Periodo desactivado",
        description: `El periodo ha sido ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`,
      })
      
      // Recargar periodos
      fetchPeriodos()
    } catch (error) {
      console.error('Error al cambiar estado del periodo:', error)
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del periodo",
        variant: "destructive",
      })
    }
  }

  const formatearFecha = (fechaStr: string) => {
    const fecha = new Date(fechaStr)
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }
  
  // Verificar si hay periodos activos con fechas pasadas
  const hayPeriodosPasadosActivos = periodos.some(periodo => {
    return periodo.activo && new Date(periodo.fecha_fin) < new Date()
  })

  const handleEditarPeriodo = (periodo: Periodo) => {
    setPeriodoEditando(periodo)
    setDialogEditarOpen(true)
  }

  const handleGuardarEdicion = async () => {
    if (!periodoEditando) return
    
    // Validar que todos los campos estén completos
    if (!periodoEditando.nombre || !periodoEditando.fecha_inicio || !periodoEditando.fecha_fin) {
      toast({
        title: "Datos incompletos",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      })
      return
    }
    
    // Validar que la fecha de fin sea posterior a la de inicio
    if (periodoEditando.fecha_inicio > periodoEditando.fecha_fin) {
      toast({
        title: "Fechas inválidas",
        description: "La fecha de fin debe ser posterior a la fecha de inicio",
        variant: "destructive",
      })
      return
    }
    
    try {
      const { error } = await supabase
        .from('periodos')
        .update({
          nombre: periodoEditando.nombre,
          fecha_inicio: periodoEditando.fecha_inicio,
          fecha_fin: periodoEditando.fecha_fin,
          activo: periodoEditando.activo
        })
        .eq('id', periodoEditando.id)
      
      if (error) throw error
      
      toast({
        title: "Periodo actualizado",
        description: "El periodo se ha actualizado correctamente",
      })
      
      // Cerrar dialog y limpiar el estado
      setDialogEditarOpen(false)
      setPeriodoEditando(null)
      
      // Recargar periodos
      fetchPeriodos()
    } catch (error) {
      console.error('Error al actualizar periodo:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el periodo",
        variant: "destructive",
      })
    }
  }

  const handleInputEdicionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (periodoEditando) {
      setPeriodoEditando(prev => ({
        ...prev!,
        [name]: value
      }))
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Configuración del Sistema</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <Label htmlFor="mostrarInactivos" className="mr-2">
              Mostrar periodos inactivos
            </Label>
            <Switch
              id="mostrarInactivos"
              checked={mostrarInactivos}
              onCheckedChange={setMostrarInactivos}
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus size={16} />
                Nuevo Periodo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Periodo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="nombre">Nombre del Periodo</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={nuevoPeriodo.nombre}
                    onChange={handleInputChange}
                    placeholder="Ej: Primer Semestre 2023"
                  />
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="fecha_inicio">Fecha de Inicio</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fecha_inicio"
                      name="fecha_inicio"
                      type="date"
                      value={nuevoPeriodo.fecha_inicio}
                      onChange={handleInputChange}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="fecha_fin">Fecha de Fin</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fecha_fin"
                      name="fecha_fin"
                      type="date"
                      value={nuevoPeriodo.fecha_fin}
                      onChange={handleInputChange}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo"
                    checked={nuevoPeriodo.activo}
                    onCheckedChange={(checked) => 
                      setNuevoPeriodo(prev => ({ ...prev, activo: checked }))
                    }
                  />
                  <Label htmlFor="activo">Periodo activo</Label>
                </div>
                <Button onClick={crearPeriodo} className="w-full">Crear Periodo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Diálogo de edición */}
      <Dialog open={dialogEditarOpen} onOpenChange={(open) => {
        setDialogEditarOpen(open)
        if (!open) setPeriodoEditando(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Periodo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {periodoEditando && (
              <>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="nombre">Nombre del Periodo</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={periodoEditando.nombre}
                    onChange={handleInputEdicionChange}
                    placeholder="Ej: Primer Semestre 2023"
                  />
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="fecha_inicio">Fecha de Inicio</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fecha_inicio"
                      name="fecha_inicio"
                      type="date"
                      value={periodoEditando.fecha_inicio}
                      onChange={handleInputEdicionChange}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="fecha_fin">Fecha de Fin</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fecha_fin"
                      name="fecha_fin"
                      type="date"
                      value={periodoEditando.fecha_fin}
                      onChange={handleInputEdicionChange}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo-editar"
                    checked={periodoEditando.activo}
                    onCheckedChange={(checked) => {
                      setPeriodoEditando(prev => ({ ...prev!, activo: checked }))
                    }}
                  />
                  <Label htmlFor="activo-editar">Periodo activo</Label>
                </div>
                <Button onClick={handleGuardarEdicion} className="w-full">Guardar Cambios</Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {hayPeriodosPasadosActivos && (
        <Alert className="mb-6 border-amber-500 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-600">Periodos pasados activos</AlertTitle>
          <AlertDescription className="text-amber-700">
            Hay periodos con fechas pasadas que aún están activos. Considere desactivarlos si ya no son necesarios.
          </AlertDescription>
        </Alert>
      )}

      {periodosInactivosConHorarios.length > 0 && (
        <Alert className="mb-6 border-orange-500 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-600">Periodos inactivos con horarios asociados</AlertTitle>
          <AlertDescription className="text-orange-700">
            Hay {periodosInactivosConHorarios.length} periodos inactivos que tienen horarios asociados. 
            Esto puede afectar a la disponibilidad de las salas. Considere activar estos periodos o eliminar los horarios asociados.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Periodos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Cargando periodos...</div>
          ) : periodos.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No hay periodos {!mostrarInactivos && "activos"} disponibles
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Fecha Fin</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodos.map((periodo) => {
                  const fechaFinPasada = new Date(periodo.fecha_fin) < new Date();
                  
                  return (
                    <TableRow key={periodo.id} className={!periodo.activo ? 'bg-gray-100' : (fechaFinPasada ? 'bg-amber-50' : '')}>
                      <TableCell className="font-medium">{periodo.nombre}</TableCell>
                      <TableCell>{formatearFecha(periodo.fecha_inicio)}</TableCell>
                      <TableCell>{formatearFecha(periodo.fecha_fin)}</TableCell>
                      <TableCell>
                        {periodo.activo ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactivo
                            {periodosInactivosConHorarios.includes(periodo.id) && (
                              <span title="Tiene horarios asociados">
                                <AlertTriangle className="h-3 w-3 ml-1 text-orange-500" />
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditarPeriodo(periodo)}
                            className="mr-2"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant={periodo.activo ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => toggleActivoPeriodo(periodo.id, periodo.activo)}
                            className={!periodo.activo ? "text-green-600 border-green-600 hover:bg-green-50" : ""}
                          >
                            {periodo.activo ? (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Activar
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

