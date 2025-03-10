"use client"

import * as React from "react"
import { X, Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Usuario {
  id: string
  nombre: string
  apellido: string
  rol: string
}

interface MultiSelectProps {
  options: Usuario[]
  selected: string[]
  onChange: (selectedValues: string[]) => void
  placeholder?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar responsables..."
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  // Asegurarse de que options sea un array
  const safeOptions = Array.isArray(options) ? options : [];
  console.log("Options recibidas:", safeOptions);
  console.log("Selected recibidos:", selected);

  const filteredOptions = safeOptions.filter(option => 
    `${option.nombre} ${option.apellido} ${option.rol}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const handleSelect = (value: string) => {
    console.log("Seleccionando:", value)
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value))
    } else {
      onChange([...selected, value])
    }
    // No cerramos el popover para permitir selecciones múltiples
  }

  const handleRemove = (value: string) => {
    console.log("Removiendo:", value)
    onChange(selected.filter(item => item !== value))
  }

  // Función para manejar clics directos en los elementos
  const handleItemClick = (e: React.MouseEvent, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(value);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" // Aseguramos que no envíe el formulario
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between min-h-10"
          onClick={() => setOpen(!open)}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            {selected.map(value => {
              const option = options.find(opt => opt.id === value)
              return option ? (
                <Badge 
                  key={value} 
                  variant="secondary"
                  className="mr-1 mb-1"
                >
                  {`${option.nombre} ${option.apellido}`}
                  <button
                    type="button" // Aseguramos que no envíe el formulario
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRemove(value)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemove(value)
                    }}
                    aria-label={`Eliminar ${option.nombre} ${option.apellido}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ) : null
            })}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm">No se encontraron usuarios</div>
            ) : (
              filteredOptions.map(option => (
                <div 
                  key={option.id}
                  className={cn(
                    "px-2 py-3 cursor-pointer flex items-center justify-between w-full hover:bg-accent hover:text-accent-foreground rounded-sm",
                    selected.includes(option.id) ? "bg-accent/50" : ""
                  )}
                  onClick={(e) => handleItemClick(e, option.id)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{`${option.nombre} ${option.apellido}`}</span>
                    <span className="text-xs text-muted-foreground">{option.rol}</span>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selected.includes(option.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>
              ))
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 