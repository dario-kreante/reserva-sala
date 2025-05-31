import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Repeat, BookOpen, Users, GraduationCap, FileText } from 'lucide-react'
import { HorarioConDescripcion } from '@/types/supabase'

interface HorarioFormProps {
  horario?: HorarioConDescripcion
  salas: Array<{ id: number; nombre: string }>
  periodos: Array<{ id: number; nombre: string; fecha_inicio: string; fecha_fin: string }>
  onSubmit: (data: HorarioFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

export interface HorarioFormData {
  sala_id: number
  periodo_id: number
  fecha: string
  hora_inicio: string
  hora_fin: string
  recurrencia: 'unico' | 'semanal' | 'mensual'
  // Campos descriptivos
  nombre_modulo: string
  profesor_responsable: string
  descripcion: string
  activo: boolean
}

export function HorarioForm({
  horario,
  salas,
  periodos,
  onSubmit,
  onCancel,
  isLoading = false
}: HorarioFormProps) {
  const [formData, setFormData] = useState<HorarioFormData>({
    sala_id: horario?.sala_id || 0,
    periodo_id: horario?.periodo_id || 0,
    fecha: horario?.fecha || '',
    hora_inicio: horario?.hora_inicio?.slice(0, 5) || '',
    hora_fin: horario?.hora_fin?.slice(0, 5) || '',
    recurrencia: horario?.recurrencia || 'semanal',
    nombre_modulo: horario?.nombre_modulo || '',
    seccion: horario?.seccion || '',
    codigo_asignatura: horario?.codigo_asignatura || '',
    profesor_responsable: horario?.profesor_responsable || '',
    descripcion: horario?.descripcion || '',
    activo: horario?.activo ?? true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.sala_id) newErrors.sala_id = 'Selecciona una sala'
    if (!formData.periodo_id) newErrors.periodo_id = 'Selecciona un período'
    if (!formData.fecha) newErrors.fecha = 'Selecciona una fecha'
    if (!formData.hora_inicio) newErrors.hora_inicio = 'Ingresa la hora de inicio'
    if (!formData.hora_fin) newErrors.hora_fin = 'Ingresa la hora de fin'
    if (!formData.nombre_modulo.trim()) newErrors.nombre_modulo = 'Ingresa el nombre del módulo'
    if (!formData.codigo_asignatura.trim()) newErrors.codigo_asignatura = 'Ingresa el código de la asignatura'
    if (!formData.profesor_responsable.trim()) newErrors.profesor_responsable = 'Ingresa el profesor responsable'

    // Validar que la hora de fin sea posterior a la de inicio
    if (formData.hora_inicio && formData.hora_fin) {
      const inicio = new Date(`2000-01-01T${formData.hora_inicio}`)
      const fin = new Date(`2000-01-01T${formData.hora_fin}`)
      if (inicio >= fin) {
        newErrors.hora_fin = 'La hora de fin debe ser posterior a la de inicio'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const handleInputChange = (field: keyof HorarioFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const getRecurrenciaLabel = (recurrencia: string) => {
    switch (recurrencia) {
      case 'unico': return 'Único'
      case 'semanal': return 'Semanal'
      case 'mensual': return 'Mensual'
      default: return recurrencia
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {horario ? 'Editar Horario' : 'Crear Nuevo Horario'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica del horario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sala_id">Sala *</Label>
              <Select 
                value={formData.sala_id.toString()} 
                onValueChange={(value) => handleInputChange('sala_id', parseInt(value))}
              >
                <SelectTrigger className={errors.sala_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecciona una sala" />
                </SelectTrigger>
                <SelectContent>
                  {salas.map((sala) => (
                    <SelectItem key={sala.id} value={sala.id.toString()}>
                      {sala.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sala_id && <p className="text-sm text-red-500">{errors.sala_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodo_id">Período Académico *</Label>
              <Select 
                value={formData.periodo_id.toString()} 
                onValueChange={(value) => handleInputChange('periodo_id', parseInt(value))}
              >
                <SelectTrigger className={errors.periodo_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecciona un período" />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((periodo) => (
                    <SelectItem key={periodo.id} value={periodo.id.toString()}>
                      {periodo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.periodo_id && <p className="text-sm text-red-500">{errors.periodo_id}</p>}
            </div>
          </div>

          {/* Fecha y horarios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de Inicio *</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => handleInputChange('fecha', e.target.value)}
                className={errors.fecha ? 'border-red-500' : ''}
              />
              {errors.fecha && <p className="text-sm text-red-500">{errors.fecha}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_inicio">Hora de Inicio *</Label>
              <Input
                id="hora_inicio"
                type="time"
                value={formData.hora_inicio}
                onChange={(e) => handleInputChange('hora_inicio', e.target.value)}
                className={errors.hora_inicio ? 'border-red-500' : ''}
              />
              {errors.hora_inicio && <p className="text-sm text-red-500">{errors.hora_inicio}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora_fin">Hora de Fin *</Label>
              <Input
                id="hora_fin"
                type="time"
                value={formData.hora_fin}
                onChange={(e) => handleInputChange('hora_fin', e.target.value)}
                className={errors.hora_fin ? 'border-red-500' : ''}
              />
              {errors.hora_fin && <p className="text-sm text-red-500">{errors.hora_fin}</p>}
            </div>
          </div>

          {/* Recurrencia */}
          <div className="space-y-2">
            <Label htmlFor="recurrencia">Tipo de Recurrencia</Label>
            <Select 
              value={formData.recurrencia} 
              onValueChange={(value: 'unico' | 'semanal' | 'mensual') => handleInputChange('recurrencia', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unico">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Único (una sola vez)
                  </div>
                </SelectItem>
                <SelectItem value="semanal">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Semanal (cada semana)
                  </div>
                </SelectItem>
                <SelectItem value="mensual">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Mensual (cada mes)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Información académica */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Información Académica
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo_asignatura">Código de Asignatura *</Label>
                <Input
                  id="codigo_asignatura"
                  value={formData.codigo_asignatura}
                  onChange={(e) => handleInputChange('codigo_asignatura', e.target.value)}
                  placeholder="ej: PSI101, MAT201"
                  className={errors.codigo_asignatura ? 'border-red-500' : ''}
                />
                {errors.codigo_asignatura && <p className="text-sm text-red-500">{errors.codigo_asignatura}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="seccion">Sección</Label>
                <Input
                  id="seccion"
                  value={formData.seccion}
                  onChange={(e) => handleInputChange('seccion', e.target.value)}
                  placeholder="ej: A, B, 01, 02"
                  className={errors.seccion ? 'border-red-500' : ''}
                />
                {errors.seccion && <p className="text-sm text-red-500">{errors.seccion}</p>}
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="nombre_modulo">Nombre del Módulo/Asignatura *</Label>
              <Input
                id="nombre_modulo"
                value={formData.nombre_modulo}
                onChange={(e) => handleInputChange('nombre_modulo', e.target.value)}
                placeholder="ej: Psicología General I, Estadística Aplicada"
                className={errors.nombre_modulo ? 'border-red-500' : ''}
              />
              {errors.nombre_modulo && <p className="text-sm text-red-500">{errors.nombre_modulo}</p>}
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="profesor_responsable">Profesor Responsable *</Label>
              <Input
                id="profesor_responsable"
                value={formData.profesor_responsable}
                onChange={(e) => handleInputChange('profesor_responsable', e.target.value)}
                placeholder="ej: Dr. María González, Prof. Juan Pérez"
                className={errors.profesor_responsable ? 'border-red-500' : ''}
              />
              {errors.profesor_responsable && <p className="text-sm text-red-500">{errors.profesor_responsable}</p>}
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="descripcion">Descripción Adicional</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                placeholder="ej: Cátedra teórica, Laboratorio práctico, Seminario de investigación"
                rows={3}
              />
            </div>
          </div>

          {/* Vista previa del título */}
          {(formData.codigo_asignatura || formData.nombre_modulo) && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Vista previa del título:</h3>
              <Badge variant="outline" className="text-sm p-2">
                {formData.codigo_asignatura && `${formData.codigo_asignatura} - `}
                {formData.nombre_modulo}
                {formData.seccion && ` (Sección ${formData.seccion})`}
                {formData.profesor_responsable && ` - ${formData.profesor_responsable}`}
              </Badge>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (horario ? 'Actualizar' : 'Crear')} Horario
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
} 