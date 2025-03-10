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
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useUsuariosData } from '@/hooks/useUsuariosData'
import { Pencil, Trash2 } from 'lucide-react'
import { Pagination } from "@/components/ui/pagination"

export default function Usuarios() {
  const { usuarios, loading, error, cambiarEstadoUsuario, crearUsuario, actualizarUsuario } = useUsuariosData()
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<any>(null)
  const [formUsuario, setFormUsuario] = useState({
    email: '',
    nombre: '',
    apellido: '',
    rut: '',
    rol: '',
    departamento: '',
    activo: true
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const roles = ['superadmin', 'admin', 'profesor', 'alumno']
  const departamentos = [
    'Psicología Educacional',
    'Psicología Clínica',
    'Psicología Organizacional',
    'Administración'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (usuarioEditando) {
        const { error } = await actualizarUsuario(usuarioEditando.id, formUsuario)
        if (error) throw error
        toast({
          title: "Usuario actualizado",
          description: "Los datos del usuario han sido actualizados exitosamente",
        })
      } else {
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
      toast({
        title: "Error",
        description: "No se pudo guardar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleEditar = (usuario: any) => {
    setUsuarioEditando(usuario)
    setFormUsuario({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rut: usuario.rut,
      rol: usuario.rol,
      departamento: usuario.departamento || '',
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
      departamento: '',
      activo: true
    })
  }

  const handleEliminar = async (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
      try {
        const { error } = await actualizarUsuario(id, { activo: false })
        if (error) throw error
        toast({
          title: "Usuario eliminado",
          description: "El usuario ha sido eliminado exitosamente",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo eliminar el usuario",
          variant: "destructive",
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
      const cumpleFiltroDepartamento = filtroDepartamento === 'todos' || usuario.departamento === filtroDepartamento
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

  if (loading) return <div className="flex justify-center p-8">Cargando usuarios...</div>
  if (error) return <div className="text-red-500 p-8">Error: {error}</div>

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Usuarios del Sistema</h1>
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
              <div>
                <Label>Departamento</Label>
                <Select 
                  value={formUsuario.departamento}
                  onValueChange={(value) => setFormUsuario(prev => ({ ...prev, departamento: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((dep) => (
                      <SelectItem key={dep} value={dep}>
                        {dep}
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
                <Label>Usuario Activo</Label>
              </div>
              <Button type="submit" className="w-full">
                {usuarioEditando ? 'Guardar Cambios' : 'Crear Usuario'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
            <div>
              <Label>Filtrar por Departamento</Label>
              <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los departamentos</SelectItem>
                  {departamentos.map((dep) => (
                    <SelectItem key={dep} value={dep}>
                      {dep}
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
                <Label>Mostrar usuarios inactivos</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsuarios().map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>{`${usuario.nombre} ${usuario.apellido}`}</TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>{usuario.rut}</TableCell>
                  <TableCell>{usuario.rol}</TableCell>
                  <TableCell>{usuario.departamento || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      usuario.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditar(usuario)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEliminar(usuario.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={usuario.activo}
                        onCheckedChange={(checked) => handleCambioEstado(usuario.id, checked)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="py-4 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              onPageChange={handlePageChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

