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
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date && onDateSelect) {
      onDateSelect(date)
      setOpen(false)
    }
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