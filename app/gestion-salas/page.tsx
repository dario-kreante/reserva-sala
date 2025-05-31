"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useRouter } from 'next/navigation'
import { MultiSelect } from '@/components/ui/multi-select'

interface Usuario {
  id: string
  nombre: string
  apellido: string
  rol: string
}

interface Sala {
  id: number
  nombre: string
  tipo: string
  capacidad: number
  centro: string
  descripcion: string | null
  responsables?: string[]
  activo: boolean
}

// Interfaz extendida para usar en el formulario
interface SalaForm extends Omit<Sala, 'id' | 'capacidad' | 'activo'> {
  capacidad: number | string
  id?: number
  responsables?: string[]
  activo?: boolean
}

export default function GestionSalas() {
  const [salas, setSalas] = useState<Sala[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mostrarInactivas, setMostrarInactivas] = useState(false)
  const [nuevaSala, setNuevaSala] = useState<SalaForm>({
    nombre: '',
    tipo: '',
    capacidad: '',
    centro: '',
    descripcion: '',
    responsables: [],
    activo: true
  })
  const [salaEditando, setSalaEditando] = useState<Sala | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const { user } = useUser()
  const router = useRouter()

  const fetchSalas = async () => {
    try {
      setLoading(true);
      console.log("Obteniendo lista de salas...");
      
      let query = supabase
        .from('salas')
        .select('*')
        .order('nombre');
      
      // Si no se muestran inactivas, filtrar solo las activas
      if (!mostrarInactivas) {
        query = query.eq('activo', true);
      }
      
      const { data, error } = await query;

      if (error) throw error

      const estadoFiltro = mostrarInactivas ? "todas" : "activas";
      console.log(`Se encontraron ${data.length} salas ${estadoFiltro}`);
      
      // Obtener los responsables para cada sala
      const salasConResponsables = await Promise.all(data.map(async (sala) => {
        console.log(`Obteniendo responsables para sala ${sala.id} (${sala.nombre})`);
        
        const { data: responsables, error: errorResponsables } = await supabase
          .from('salas_responsables')
          .select('usuario_id')
          .eq('sala_id', sala.id)

        if (errorResponsables) {
          console.error(`Error al obtener responsables para sala ${sala.id}:`, errorResponsables);
          return {
            ...sala,
            responsables: []
          };
        }

        console.log(`Se encontraron ${responsables.length} responsables para sala ${sala.id}`);
        
        return {
          ...sala,
          responsables: responsables.map(r => r.usuario_id)
        };
      }));

      setSalas(salasConResponsables);
      console.log("Lista de salas actualizada con éxito");
      
      // Forzar actualización de los componentes de responsables
      setTimeout(() => {
        const responsablesElements = document.querySelectorAll('[data-sala-responsables]');
        responsablesElements.forEach(el => {
          // Disparar un evento personalizado para forzar la actualización
          const event = new CustomEvent('update-responsables');
          el.dispatchEvent(event);
        });
      }, 100);
      
    } catch (error) {
      console.error('Error fetching salas:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las salas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUsuarios = async () => {
    try {
      console.log("Cargando usuarios administradores...");
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, rol')
        .in('rol', ['admin', 'administrativo'])
        .eq('activo', true)
        .order('nombre')

      if (error) {
        console.error("Error al cargar usuarios:", error);
        throw error;
      }

      console.log("Usuarios cargados:", data);
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error fetching usuarios:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
      // Establecer un array vacío para evitar errores
      setUsuarios([]);
    }
  }

  useEffect(() => {
    if (user && user.rol !== 'superadmin') {
      router.push('/')
      return
    }
    fetchSalas()
    fetchUsuarios()
  }, [user, router, mostrarInactivas])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNuevaSala(prev => ({
      ...prev,
      [name]: name === 'capacidad' ? (value === '' ? '' : parseInt(value) || 0) : value
    }))
  }

  const handleSelectChange = (value: string) => {
    setNuevaSala(prev => ({ ...prev, tipo: value }))
  }

  const handleResponsablesChange = (selectedValues: string[]) => {
    console.log("Responsables seleccionados:", selectedValues);
    
    // Asegurarse de que el valor sea un array
    const validValues = Array.isArray(selectedValues) ? selectedValues : [];
    
    // Actualizar el estado con los valores seleccionados
    setNuevaSala(prev => {
      const updated = { 
        ...prev, 
        responsables: validValues 
      };
      console.log("Nueva sala actualizada:", updated);
      return updated;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Asegurarse de que capacidad sea un número al guardar
      const capacidadNumerica = typeof nuevaSala.capacidad === 'string' 
        ? (nuevaSala.capacidad === '' ? 0 : parseInt(nuevaSala.capacidad)) 
        : nuevaSala.capacidad;
      
      // Crear una copia del objeto con capacidad convertida a número
      const salaData = {
        ...nuevaSala,
        capacidad: capacidadNumerica,
        activo: true
      };
        
      if (salaEditando) {
        // Actualizar sala existente
        const { error } = await supabase
          .from('salas')
          .update({
            nombre: salaData.nombre,
            tipo: salaData.tipo,
            capacidad: salaData.capacidad,
            centro: salaData.centro,
            descripcion: salaData.descripcion,
            activo: true
          })
          .eq('id', salaEditando.id)

        if (error) throw error

        // Actualizar responsables
        // Primero eliminar todos los responsables actuales
        const { error: errorDelete } = await supabase
          .from('salas_responsables')
          .delete()
          .eq('sala_id', salaEditando.id)

        if (errorDelete) throw errorDelete

        // Luego insertar los nuevos responsables
        if (salaData.responsables && salaData.responsables.length > 0) {
          const responsablesData = salaData.responsables.map(usuarioId => ({
            sala_id: salaEditando.id,
            usuario_id: usuarioId
          }))

          const { error: errorInsert } = await supabase
            .from('salas_responsables')
            .insert(responsablesData)

          if (errorInsert) throw errorInsert
        }

        toast({
          title: "Sala actualizada",
          description: "La sala ha sido actualizada exitosamente",
        })
      } else {
        // Crear nueva sala
        const { data, error } = await supabase
          .from('salas')
          .insert([{
            nombre: salaData.nombre,
            tipo: salaData.tipo,
            capacidad: salaData.capacidad,
            centro: salaData.centro,
            descripcion: salaData.descripcion,
            activo: true
          }])
          .select()

        if (error) throw error

        // Insertar responsables si hay alguno seleccionado
        if (salaData.responsables && salaData.responsables.length > 0 && data && data.length > 0) {
          const salaId = data[0].id
          const responsablesData = salaData.responsables.map(usuarioId => ({
            sala_id: salaId,
            usuario_id: usuarioId
          }))

          const { error: errorResponsables } = await supabase
            .from('salas_responsables')
            .insert(responsablesData)

          if (errorResponsables) throw errorResponsables
        }

        toast({
          title: "Sala creada",
          description: "La sala ha sido creada exitosamente",
        })
      }

      // Cerrar el diálogo y resetear el formulario
      setDialogOpen(false)
      setSalaEditando(null)
      setNuevaSala({
        nombre: '',
        tipo: '',
        capacidad: '',
        centro: '',
        descripcion: '',
        responsables: [],
        activo: true
      })
      
      // Actualizar los datos de la tabla
      console.log("Actualizando datos después de guardar...");
      await fetchSalas(); // Esperar a que se complete la actualización de salas
      
      // Actualizar los componentes de responsables en la tabla
      const responsablesElements = document.querySelectorAll('[data-sala-responsables]');
      if (responsablesElements.length > 0) {
        console.log(`Actualizando ${responsablesElements.length} componentes de responsables`);
      }
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: `No se pudo ${salaEditando ? 'actualizar' : 'crear'} la sala`,
        variant: "destructive",
      })
    }
  }

  const handleEliminar = async (id: number) => {
    if (confirm('¿Está seguro de desactivar esta sala? No se eliminará, pero ya no estará disponible para nuevas reservas.')) {
      try {
        // En lugar de eliminar, actualizar el campo 'activo' a false
        const { error } = await supabase
          .from('salas')
          .update({ activo: false })
          .eq('id', id)

        if (error) throw error

        toast({
          title: "Sala desactivada",
          description: "La sala ha sido desactivada exitosamente. Se conserva el historial de reservas.",
        })

        fetchSalas()
      } catch (error) {
        console.error('Error al desactivar sala:', error)
        toast({
          title: "Error",
          description: "No se pudo desactivar la sala",
          variant: "destructive",
        })
      }
    }
  }

  const handleEditar = async (sala: Sala) => {
    try {
      // Obtener los responsables de la sala
      const { data: responsables, error } = await supabase
        .from('salas_responsables')
        .select('usuario_id')
        .eq('sala_id', sala.id)

      if (error) throw error

      setSalaEditando(sala)
      setNuevaSala({
        nombre: sala.nombre,
        tipo: sala.tipo,
        capacidad: sala.capacidad,
        centro: sala.centro,
        descripcion: sala.descripcion || '',
        responsables: responsables.map(r => r.usuario_id),
        activo: sala.activo
      })
      setDialogOpen(true)
    } catch (error) {
      console.error('Error al obtener responsables:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los responsables de la sala",
        variant: "destructive",
      })
    }
  }

  const getNombresResponsables = async (salaId: number) => {
    try {
      const { data, error } = await supabase
        .from('salas_responsables')
        .select(`
          usuario_id,
          usuarios:usuario_id (
            nombre,
            apellido
          )
        `)
        .eq('sala_id', salaId)

      if (error) throw error

      return data.map(r => `${r.usuarios[0].nombre} ${r.usuarios[0].apellido}`).join(', ')
    } catch (error) {
      console.error('Error al obtener nombres de responsables:', error)
      return 'Error al cargar responsables'
    }
  }

  const handleReactivar = async (id: number) => {
    if (confirm('¿Está seguro de reactivar esta sala? Volverá a estar disponible para reservas.')) {
      try {
        const { error } = await supabase
          .from('salas')
          .update({ activo: true })
          .eq('id', id)

        if (error) throw error

        toast({
          title: "Sala reactivada",
          description: "La sala ha sido reactivada exitosamente y está disponible para reservas.",
        })

        fetchSalas()
      } catch (error) {
        console.error('Error al reactivar sala:', error)
        toast({
          title: "Error",
          description: "No se pudo reactivar la sala",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gestión de Salas</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <Label htmlFor="mostrarInactivas" className="mr-2">
              Mostrar salas inactivas
            </Label>
            <input
              type="checkbox"
              id="mostrarInactivas"
              checked={mostrarInactivas}
              onChange={(e) => setMostrarInactivas(e.target.checked)}
              className="h-4 w-4"
              title="Mostrar salas inactivas"
            />
          </div>
          <Dialog 
            open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setSalaEditando(null)
                setNuevaSala({
                  nombre: '',
                  tipo: '',
                  capacidad: '',
                  centro: '',
                  descripcion: '',
                  responsables: [],
                  activo: true
                })
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>Nueva Sala</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {salaEditando ? 'Editar Sala' : 'Crear Nueva Sala'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={nuevaSala.nombre}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select 
                    value={nuevaSala.tipo} 
                    onValueChange={handleSelectChange} 
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Clase">Clase</SelectItem>
                      <SelectItem value="Auditorio">Auditorio</SelectItem>
                      <SelectItem value="Reunión">Reunión</SelectItem>
                      <SelectItem value="Laboratorio">Laboratorio</SelectItem>
                      <SelectItem value="Terapia">Terapia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="capacidad">Capacidad</Label>
                  <Input
                    id="capacidad"
                    name="capacidad"
                    type="number"
                    min="1"
                    value={nuevaSala.capacidad === 0 && !salaEditando ? '' : nuevaSala.capacidad}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="centro">Centro</Label>
                  <Input
                    id="centro"
                    name="centro"
                    value={nuevaSala.centro}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    name="descripcion"
                    value={nuevaSala.descripcion || ''}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="responsables">Responsables</Label>
                  <MultiSelect
                    options={usuarios}
                    selected={nuevaSala.responsables || []}
                    onChange={handleResponsablesChange}
                    placeholder="Seleccionar responsables"
                  />
                  {/* Mostrar los responsables seleccionados para depuración */}
                  {nuevaSala.responsables && nuevaSala.responsables.length > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Responsables seleccionados: {nuevaSala.responsables.length}
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit">
                    {salaEditando ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Capacidad</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Responsables</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    No hay salas registradas
                  </TableCell>
                </TableRow>
              ) : (
                salas.map((sala) => (
                  <TableRow key={sala.id} className={!sala.activo ? 'bg-gray-100' : ''}>
                    <TableCell className="font-medium">{sala.nombre}</TableCell>
                    <TableCell>{sala.tipo}</TableCell>
                    <TableCell>{sala.capacidad}</TableCell>
                    <TableCell>{sala.centro}</TableCell>
                    <TableCell>
                      <ResponsablesList salaId={sala.id} />
                    </TableCell>
                    <TableCell>
                      {sala.activo ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactiva
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditar(sala)}
                        className="mr-2"
                      >
                        Editar
                      </Button>
                      {sala.activo ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEliminar(sala.id)}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivar(sala.id)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          Reactivar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// Componente para mostrar los responsables de una sala
function ResponsablesList({ salaId }: { salaId: number }) {
  const [responsables, setResponsables] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const containerRef = useRef<HTMLDivElement>(null)

  // Función para forzar la actualización del componente
  const forceUpdate = useCallback(() => {
    console.log(`Forzando actualización de responsables para sala ${salaId}`);
    setLastUpdate(Date.now());
  }, [salaId]);

  // Efecto para escuchar el evento de actualización
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const handleUpdateEvent = () => forceUpdate();
      container.addEventListener('update-responsables', handleUpdateEvent);
      
      return () => {
        container.removeEventListener('update-responsables', handleUpdateEvent);
      };
    }
  }, [forceUpdate]);

  // Efecto para cargar los responsables
  useEffect(() => {
    async function getResponsables() {
      try {
        setLoading(true);
        // Obtener IDs de responsables
        const { data: responsablesData, error: responsablesError } = await supabase
          .from('salas_responsables')
          .select('usuario_id')
          .eq('sala_id', salaId)
        
        if (responsablesError) {
          console.error('Error al obtener responsables:', responsablesError)
          setResponsables(['Error al cargar responsables'])
          return
        }
        
        if (!responsablesData || responsablesData.length === 0) {
          setResponsables([])
          setLoading(false)
          return
        }
        
        // Obtener nombres de usuarios
        const ids = responsablesData.map(r => r.usuario_id)
        const { data: usuarios, error: usuariosError } = await supabase
          .from('usuarios')
          .select('nombre, apellido')
          .in('id', ids)
        
        if (usuariosError || !usuarios) {
          console.error('Error al obtener usuarios:', usuariosError)
          setResponsables(['Error al cargar usuarios'])
          return
        }
        
        // Crear lista de nombres
        const nombres = usuarios.map((u: any) => `${u.nombre} ${u.apellido}`)
        setResponsables(nombres)
      } catch (error) {
        console.error('Error general:', error)
        setResponsables(['Error al cargar datos'])
      } finally {
        setLoading(false)
      }
    }
    
    getResponsables()
  }, [salaId, lastUpdate]) // Añadir lastUpdate como dependencia para forzar actualizaciones

  if (loading) return <span>Cargando...</span>
  
  return (
    <div 
      ref={containerRef}
      data-sala-responsables={salaId} 
      data-last-update={lastUpdate}
    >
      {responsables.length > 0 ? (
        responsables.map((nombre, index) => (
          <div key={index}>{nombre}</div>
        ))
      ) : (
        <span className="text-gray-500">Sin responsables</span>
      )}
    </div>
  )
}

