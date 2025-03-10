"use client"

import * as React from "react"
import { Search, User, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UserSelectProps {
  users: Array<{
    id: string
    nombre: string
    apellido: string
    rol: string
  }>
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  isLoading?: boolean
}

export function UserSelect({
  users,
  value,
  onValueChange,
  placeholder = "Seleccionar usuario",
  isLoading = false
}: UserSelectProps) {
  const [search, setSearch] = React.useState("")
  const [open, setOpen] = React.useState(false)
  
  // Memoizar los usuarios filtrados para evitar recálculos innecesarios
  const filteredUsers = React.useMemo(() => {
    if (!search.trim()) return users;
    
    return users.filter(user => 
      `${user.nombre} ${user.apellido} ${user.rol}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [users, search]);

  // Encontrar el usuario seleccionado una sola vez
  const selectedUser = React.useMemo(() => {
    return value ? users.find(u => u.id === value) : null;
  }, [users, value]);

  // Limpiar la búsqueda cuando se cierra el dropdown
  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <Select 
      value={value} 
      onValueChange={onValueChange}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {isLoading ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>Cargando usuarios...</span>
            </div>
          ) : selectedUser ? (
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{`${selectedUser.nombre} ${selectedUser.apellido}`}</span>
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 bg-popover border-b px-3 pb-2">
          <div className="flex items-center gap-2 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex w-full bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
              No se encontraron usuarios
            </p>
          ) : (
            filteredUsers.map((user) => (
              <SelectItem 
                key={user.id} 
                value={user.id}
                className="cursor-pointer"
              >
                <div className="flex flex-col py-1">
                  <span className="font-medium">{`${user.nombre} ${user.apellido}`}</span>
                  <span className="text-xs text-muted-foreground">{user.rol}</span>
                </div>
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  )
} 