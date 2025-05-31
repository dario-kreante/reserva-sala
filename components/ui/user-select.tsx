"use client"

import * as React from "react"
import { Search, User, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Encontrar el usuario seleccionado
  const selectedUser = React.useMemo(() => {
    return value ? users.find(u => u.id === value) : null;
  }, [users, value]);

  // Filtrar usuarios basado en la búsqueda
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      `${user.nombre} ${user.apellido} ${user.rol}`
        .toLowerCase()
        .includes(query)
    );
  }, [users, searchQuery]);

  // Manejar la selección de un usuario
  const handleSelect = (userId: string) => {
    onValueChange(userId);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9"
          onClick={() => setOpen(true)}
        >
          {isLoading ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span>Cargando usuarios...</span>
            </div>
          ) : selectedUser ? (
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="truncate">{`${selectedUser.nombre} ${selectedUser.apellido}`}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[300px]" align="start">
        <div className="flex flex-col">
          {/* Barra de búsqueda */}
          <div className="flex items-center border-b px-3 pb-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Buscar usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              role="searchbox"
            />
          </div>

          {/* Lista de resultados */}
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
              <div className="py-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user.id)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground",
                      value === user.id && "bg-accent/50"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">{`${user.nombre} ${user.apellido}`}</span>
                        <span className="text-xs text-muted-foreground">{user.rol}</span>
                      </div>
                      {value === user.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 