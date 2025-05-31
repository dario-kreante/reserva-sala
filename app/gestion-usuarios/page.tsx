"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  rut: string
  rol: string
  departamento: string | null
  activo: boolean
}

interface NuevoUsuario {
  email: string
  nombre: string
  apellido: string
  rut: string
  rol: string
  departamento?: string
  activo: boolean
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filtro, setFiltro] = useState('')
  const { user } = useUser()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState<NuevoUsuario>({
    email: '',
    nombre: '',
    apellido: '',
    rut: '',
    rol: '',
    departamento: '',
    activo: true
  })
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null)

  const roles = ['admin', 'usuario', 'superadmin', 'administrativo']
  const departamentos = ['Informática', 'Recursos Humanos', 'Finanzas', 'Marketing', 'Operaciones']

  useEffect(() => {
    if (user && user.rol !== 'superadmin') {
      router.push('/')
      return
    }
    fetchUsuarios()
  }, [user, router])

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('apellido')

    if (error) {
      console.error('Error fetching usuarios:', error)
      return
    }

    setUsuarios(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editandoUsuario) {
        const { error } = await supabase
          .from('usuarios')
          .update({
            email: nuevoUsuario.email,
            nombre: nuevoUsuario.nombre,
            apellido: nuevoUsuario.apellido,
            rut: nuevoUsuario.rut,
            rol: nuevoUsuario.rol,
            departamento: nuevoUsuario.departamento || null,
            activo: nuevoUsuario.activo
          })
          .eq('id', editandoUsuario.id)

        if (error) throw error

        toast({
          title: "Usuario actualizado",
          description: "El usuario ha sido actualizado exitosamente",
        })
      } else {
        const { error } = await supabase
          .from('usuarios')
          .insert({
            ...nuevoUsuario,
            departamento: nuevoUsuario.departamento || null
          })

        if (error) throw error

        toast({
          title: "Usuario creado",
          description: "El usuario ha sido creado exitosamente",
        })
      }

      setDialogOpen(false)
      resetForm()
      fetchUsuarios()
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar el usuario",
        variant: "destructive",
      })
    }
  }

  const handleEditarUsuario = (usuario: Usuario) => {
    setEditandoUsuario(usuario)
    setNuevoUsuario({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rut: usuario.rut,
      rol: usuario.rol,
      departamento: usuario.departamento || '',
      activo: usuario.activo
    })
    setDialogOpen(true)
  }

  const resetForm = () => {
    setNuevoUsuario({
      email: '',
      nombre: '',
      apellido: '',
      rut: '',
      rol: '',
      departamento: '',
      activo: true
    })
    setEditandoUsuario(null)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editandoUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={nuevoUsuario.email}
                  onChange={(e) => setNuevoUsuario(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Nombre</Label>
                <Input
                  value={nuevoUsuario.nombre}
                  onChange={(e) => setNuevoUsuario(prev => ({ ...prev, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input
                  value={nuevoUsuario.apellido}
                  onChange={(e) => setNuevoUsuario(prev => ({ ...prev, apellido: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>RUT</Label>
                <Input
                  value={nuevoUsuario.rut}
                  onChange={(e) => setNuevoUsuario(prev => ({ ...prev, rut: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Rol</Label>
                <Select 
                  value={nuevoUsuario.rol}
                  onValueChange={(value) => setNuevoUsuario(prev => ({ ...prev, rol: value }))}
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
                  value={nuevoUsuario.departamento}
                  onValueChange={(value) => setNuevoUsuario(prev => ({ ...prev, departamento: value }))}
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
                  checked={nuevoUsuario.activo}
                  onCheckedChange={(checked) => setNuevoUsuario(prev => ({ ...prev, activo: checked }))}
                />
                <Label>Usuario Activo</Label>
              </div>
              <Button type="submit" className="w-full">
                {editandoUsuario ? 'Guardar Cambios' : 'Crear Usuario'}
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
              {filtrarUsuarios().map((usuario) => (
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditarUsuario(usuario)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 