"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Combobox } from "@/components/ui/combobox"
import { useUsuariosData, FormUsuarioData, Departamento, Usuario } from '@/hooks/useUsuariosData' 
import { Pencil, Trash2, PlusCircle, RefreshCw } from 'lucide-react'
import { Pagination } from "@/components/ui/pagination"

// --- Componente: GestionDepartamentosDialog (Definido ANTES de Usuarios) ---
interface GestionDepartamentosDialogProps {
  isOpen: boolean;
  onClose: () => void;
  departamentos: Departamento[];
  onAddDepartamento: (nombre: string) => Promise<{ data: Departamento | null; error: string | null }>;
  onToggleActivo: (id: number, estadoActual: boolean) => Promise<{ error: string | null }>;
  onRefresh: () => void;
  loading: boolean;
}

function GestionDepartamentosDialog({ 
  isOpen, 
  onClose, 
  departamentos, 
  onAddDepartamento, 
  onToggleActivo, 
  onRefresh,
  loading
}: GestionDepartamentosDialogProps) {
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isToggling, setIsToggling] = useState<number | null>(null); // ID del depto cuyo estado se está cambiando

  const handleAdd = async () => {
    if (!nuevoNombre.trim()) return;
    setIsAdding(true);
    const { error } = await onAddDepartamento(nuevoNombre);
    setIsAdding(false);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      setNuevoNombre(''); // Limpiar input en éxito
      toast({ title: "Éxito", description: "Departamento añadido." });
      // La lista se actualiza automáticamente desde el hook
    }
  };

  const handleToggle = async (dep: Departamento) => {
    setIsToggling(dep.id);
    const { error } = await onToggleActivo(dep.id, dep.activo);
    setIsToggling(null);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Éxito", description: `Estado de ${dep.nombre} actualizado.` });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gestionar Departamentos</DialogTitle>
          <DialogDescription>
            Añade nuevos departamentos o activa/desactiva los existentes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* Añadir Nuevo Departamento */}
          <div className="flex gap-2">
            <Input
              placeholder="Nombre del nuevo departamento"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              disabled={isAdding}
            />
            <Button onClick={handleAdd} disabled={!nuevoNombre.trim() || isAdding}>
              {isAdding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} 
              Añadir
            </Button>
          </div>

          {/* Lista de Departamentos */}
          <div className="max-h-[300px] overflow-y-auto border rounded-md p-2 space-y-2">
            {loading ? (
              <p className="text-center text-muted-foreground">Cargando...</p>
            ) : departamentos.length === 0 ? (
               <p className="text-center text-muted-foreground">No hay departamentos.</p>
            ) : (
              departamentos.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between gap-2 p-2 border-b last:border-b-0">
                  <span className={`flex-1 ${!dep.activo ? 'text-muted-foreground line-through' : ''}`}>
                    {dep.nombre}
                  </span>
                  <Button 
                    variant={dep.activo ? "outline" : "default"} 
                    size="sm"
                    onClick={() => handleToggle(dep)}
                    disabled={isToggling === dep.id}
                  >
                    {isToggling === dep.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : (dep.activo ? 'Desactivar' : 'Activar')}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
         <DialogFooter>
           <Button variant="outline" onClick={onClose}>Cerrar</Button>
         </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Componente Principal: Usuarios ---
export default function Usuarios() {
  // Obtener departamentos del hook
  const { 
    usuarios, 
    departamentos, // Obtener lista de departamentos
    loading, 
    loadingDepartamentos, // Obtener estado de carga
    error, 
    cambiarEstadoUsuario, 
    crearUsuario, 
    actualizarUsuario,
    crearDepartamento, // Obtener la nueva función
    toggleDepartamentoActivo,
    fetchDepartamentos
  } = useUsuariosData()
  
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos') // Usará el ID como string o 'todos'
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<any>(null) // Mantener any por ahora o usar el tipo Usuario del hook
  const [dialogoDepartamentosAbierto, setDialogoDepartamentosAbierto] = useState(false)
  
  // Actualizar estado inicial y tipo para usar departamento_id (como string o null)
  const [formUsuario, setFormUsuario] = useState<FormUsuarioData>({
    email: '',
    nombre: '',
    apellido: '',
    rut: '',
    rol: '',
    departamento_id: null, // Usar null como valor inicial para "Sin departamento"
    activo: true,
    // Asegurarse de que otras propiedades requeridas por FormUsuarioData estén aquí si las hay
  });

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const roles = ['superadmin', 'admin', 'profesor', 'alumno', 'administrativo']
  // const departamentos = [...] // Eliminar lista hardcoded

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (usuarioEditando) {
        // Pasar formUsuario directamente (el hook maneja la conversión de ID)
        const { error } = await actualizarUsuario(usuarioEditando.id, formUsuario)
        if (error) throw error
        toast({
          title: "Usuario actualizado",
          description: "Los datos del usuario han sido actualizados exitosamente",
        })
      } else {
        // Pasar formUsuario directamente
        const { error } = await crearUsuario(formUsuario)
        if (error) throw error
        toast({
          title: "Usuario creado",
          description: "El nuevo usuario ha sido creado exitosamente",
        })
      }
      setDialogoAbierto(false)
      resetForm()
    } catch (error) {
      console.error("Error guardando usuario:", error)
      toast({
        title: "Error",
        // Mostrar mensaje de error más específico si está disponible
        description: error instanceof Error ? error.message : "No se pudo guardar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleEditar = (usuario: any) => { // Usar tipo Usuario del hook si es posible
    setUsuarioEditando(usuario)
    setFormUsuario({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rut: usuario.rut,
      rol: usuario.rol,
      // Establecer departamento_id como string o null
      departamento_id: usuario.departamento_id ? usuario.departamento_id.toString() : null,
      activo: usuario.activo
    })
    setDialogoAbierto(true)
  }

  const resetForm = () => {
    setUsuarioEditando(null)
    setFormUsuario({
      email: '',
      nombre: '',
      apellido: '',
      rut: '',
      rol: '',
      departamento_id: null,
      activo: true
    })
  }

  const handleEliminar = async (id: string) => {
    // Cambiado para usar cambiarEstadoUsuario en lugar de actualizarUsuario con {activo: false}
    // Asumiendo que eliminar realmente significa desactivar
    if (confirm('¿Está seguro de que desea desactivar este usuario?')) { 
      const { error } = await cambiarEstadoUsuario(id, false) // Desactivar usuario
      if (error) {
        toast({
          title: "Error",
          description: "No se pudo desactivar el usuario",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Usuario desactivado",
          description: "El usuario ha sido desactivado exitosamente",
        })
      }
    }
  }

  const filtrarUsuarios = () => {
    return usuarios.filter(usuario => {
      const cumpleBusqueda = 
        `${usuario.nombre} ${usuario.apellido} ${usuario.email} ${usuario.rut}`
          .toLowerCase()
          .includes(busqueda.toLowerCase())
      const cumpleFiltroRol = filtroRol === 'todos' || usuario.rol === filtroRol
      // Filtrar por departamento_id (convertir filtroDepartamento a número si no es 'todos')
      const cumpleFiltroDepartamento = filtroDepartamento === 'todos' || usuario.departamento_id?.toString() === filtroDepartamento
      const cumpleActivo = mostrarInactivos ? true : usuario.activo

      return cumpleBusqueda && cumpleFiltroRol && cumpleFiltroDepartamento && cumpleActivo
    })
  }

  const handleCambioEstado = async (id: string, nuevoEstado: boolean) => {
    const { error } = await cambiarEstadoUsuario(id, nuevoEstado)
    if (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del usuario",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Estado actualizado",
        description: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`,
      })
    }
  }

  const paginatedUsuarios = () => {
    const usuariosFiltrados = filtrarUsuarios()
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return usuariosFiltrados.slice(startIndex, endIndex)
  }

  const totalPages = Math.ceil(filtrarUsuarios().length / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Mostrar carga si usuarios o departamentos están cargando
  if (loading || loadingDepartamentos) return <div className="flex justify-center p-8">Cargando datos...</div>
  if (error) return <div className="text-red-500 p-8">Error: {error}</div>

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Usuarios del Sistema</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogoDepartamentosAbierto(true)}>
            Gestionar Departamentos
          </Button>
        <Dialog open={dialogoAbierto} onOpenChange={(open) => {
          setDialogoAbierto(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {usuarioEditando ? 'Editar Usuario' : 'Nuevo Usuario'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={formUsuario.nombre}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input
                    value={formUsuario.apellido}
                    onChange={(e) => setFormUsuario(prev => ({ ...prev, apellido: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>RUT</Label>
                <Input
                  value={formUsuario.rut}
                  onChange={(e) => setFormUsuario(prev => ({ ...prev, rut: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Rol</Label>
                <Select 
                  value={formUsuario.rol}
                  onValueChange={(value) => setFormUsuario(prev => ({ ...prev, rol: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol.charAt(0).toUpperCase() + rol.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                {/* Volver a usar Select para Departamento */}
              <div>
                <Label>Departamento</Label>
                <Select 
                    // Usar departamento_id. Convertir null a 'none' para el Select
                    value={formUsuario.departamento_id?.toString() ?? 'none'} 
                    onValueChange={(value) => {
                        // Convertir 'none' de vuelta a null, otros valores son IDs (string)
                        const newDeptId = value === 'none' ? null : value;
                        setFormUsuario(prev => ({ ...prev, departamento_id: newDeptId }))
                    }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione departamento" />
                  </SelectTrigger>
                  <SelectContent>
                      {/* Opción para Sin Departamento */}
                      <SelectItem value="none">Sin Departamento</SelectItem> 
                      {/* Mapear departamentos obtenidos del hook */}
                    {departamentos.map((dep) => (
                        <SelectItem key={dep.id} value={dep.id.toString()}>
                          {dep.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formUsuario.activo}
                  onCheckedChange={(checked) => setFormUsuario(prev => ({ ...prev, activo: checked }))}
                />
                  <Label>Activo</Label>
              </div>
                <Button type="submit">{usuarioEditando ? 'Actualizar' : 'Crear'} Usuario</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Buscar</Label>
              <Input
                placeholder="Buscar usuarios..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div>
              <Label>Filtrar por Rol</Label>
              <Select value={filtroRol} onValueChange={setFiltroRol}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  {roles.map((rol) => (
                    <SelectItem key={rol} value={rol}>
                      {rol.charAt(0).toUpperCase() + rol.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Filtro de Departamento actualizado */}
            <div>
              <Label>Filtrar por Departamento</Label>
              <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los departamentos</SelectItem>
                  {/* Usar lista de departamentos del hook */}
                  {departamentos.map((dep) => (
                    <SelectItem key={dep.id} value={dep.id.toString()}>
                      {dep.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={mostrarInactivos}
                  onCheckedChange={setMostrarInactivos}
                />
                <Label>Mostrar inactivos</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Usuarios */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Departamento</TableHead> {/* Columna Departamento */}
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsuarios().map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>{usuario.nombre} {usuario.apellido}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>{usuario.rut}</TableCell>
                  <TableCell>{usuario.rol}</TableCell>
                  {/* Mostrar nombre del departamento desde el objeto (si existe) */}
                  <TableCell>{usuario.departamento?.nombre || '-'}</TableCell> 
                  <TableCell>
                      <Switch
                        checked={usuario.activo}
                        onCheckedChange={(checked) => handleCambioEstado(usuario.id, checked)}
                      />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditar(usuario)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </Button>
                      {/* El botón eliminar ahora desactiva */}
                      {/* <Button variant="destructive" size="sm" onClick={() => handleEliminar(usuario.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar 
                      </Button> */}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginación */}
      <div className="mt-6">
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>

      {/* Diálogo para Gestionar Departamentos */}
      <GestionDepartamentosDialog
        isOpen={dialogoDepartamentosAbierto}
        onClose={() => setDialogoDepartamentosAbierto(false)}
        departamentos={departamentos}
        onAddDepartamento={crearDepartamento}
        onToggleActivo={toggleDepartamentoActivo}
        onRefresh={fetchDepartamentos}
        loading={loadingDepartamentos}
      />
    </div>
  )
}

