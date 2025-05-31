import { useState } from "react";
import { esFechaValida } from "@/app/utils/horarioValidation";
import { useToast } from "@/components/ui/use-toast";

interface DisponibilidadModalProps {
  onDateSelect: (date: Date) => void;
}

export function DisponibilidadModal({
  onDateSelect,
}: DisponibilidadModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const fechaFormateada = date.toISOString().split('T')[0];
      
      if (!esFechaValida(fechaFormateada)) {
        toast({
          title: "Fecha inválida",
          description: "No se pueden seleccionar fechas pasadas",
          variant: "destructive",
        });
        return;
      }
      
      onDateSelect(date);
    }
    setOpen(false);
  };
} 