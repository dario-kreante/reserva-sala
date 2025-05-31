import { useState } from 'react'
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"

interface HorarioOcupado {
  horaInicio: string;
  horaFin: string;
}

interface ReservationCalendarProps {
  fecha: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  horariosOcupados: HorarioOcupado[];
}

export function ReservationCalendar({ fecha, onDateChange, horariosOcupados }: ReservationCalendarProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Calendar
          mode="single"
          selected={fecha}
          onSelect={onDateChange}
          className="rounded-md border"
        />
        {fecha && horariosOcupados.length > 0 && (
          <div className="p-4">
            <h3 className="font-semibold mb-2">Horarios Ocupados:</h3>
            <ul className="space-y-1">
              {horariosOcupados.map((horario, index) => (
                <li key={index} className="text-sm">
                  {horario.horaInicio} - {horario.horaFin}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 