"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import { DisponibilidadCalendario } from "@/components/ui/disponibilidad-calendario"
import { useToast } from "@/components/ui/use-toast"
import { esFechaValida } from "@/app/utils/horarioValidation"

interface DisponibilidadModalProps {
  salaId: number | null
  salaName?: string
  onDateSelect?: (date: Date) => void
  disabled?: boolean
  buttonClassName?: string
}

export function DisponibilidadModal({
  salaId,
  salaName,
  onDateSelect,
  disabled = false,
  buttonClassName = ""
}: DisponibilidadModalProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Validar que la fecha no sea en el pasado
      const fechaFormateada = date.toISOString().split('T')[0]
      
      if (!esFechaValida(fechaFormateada)) {
        toast({
          title: "Fecha inválida",
          description: "No se pueden seleccionar fechas pasadas",
          variant: "destructive",
        })
        setOpen(false)
        return
      }
      
      // Si la fecha es válida y hay callback, llamarlo
      if (onDateSelect) {
        onDateSelect(date)
      }
    }
    setOpen(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`mt-2 ${buttonClassName}`}
          disabled={disabled || !salaId}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Ver disponibilidad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Disponibilidad de {salaName || 'sala'}
          </DialogTitle>
        </DialogHeader>
        <DisponibilidadCalendario 
          salaId={salaId} 
          onDateSelect={handleDateSelect}
        />
      </DialogContent>
    </Dialog>
  )
} 