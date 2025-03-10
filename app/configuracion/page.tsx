"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"

interface Configuracion {
  diasProtegidos: string[];
  tiempoMaximoReserva: number;
  limiteSolicitudesPendientes: number;
  anticipacionMaximaReserva: number;
  notificacionesEmail: boolean;
  tiempoAntelacionRecordatorio: number;
}

const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function Configuracion() {
  const [config, setConfig] = useState<Configuracion>({
    diasProtegidos: ['Lunes', 'Miércoles', 'Viernes'],
    tiempoMaximoReserva: 120,
    limiteSolicitudesPendientes: 5,
    anticipacionMaximaReserva: 30,
    notificacionesEmail: true,
    tiempoAntelacionRecordatorio: 24,
  })

  const handleDiaProtegidoChange = (dia: string) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      diasProtegidos: prevConfig.diasProtegidos.includes(dia)
        ? prevConfig.diasProtegidos.filter(d => d !== dia)
        : [...prevConfig.diasProtegidos, dia]
    }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: parseInt(value, 10)
    }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      notificacionesEmail: checked
    }))
  }

  const handleGuardarConfiguracion = () => {
    // Aquí iría la lógica para guardar la configuración en el backend
    console.log('Configuración guardada:', config)
    toast({
      title: "Configuración guardada",
      description: "Los cambios han sido aplicados correctamente.",
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Configuración del Sistema</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tiempoMaximoReserva">Tiempo Máximo de Reserva (minutos)</Label>
              <Input
                id="tiempoMaximoReserva"
                name="tiempoMaximoReserva"
                type="number"
                value={config.tiempoMaximoReserva}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="limiteSolicitudesPendientes">Límite de Solicitudes Pendientes</Label>
              <Input
                id="limiteSolicitudesPendientes"
                name="limiteSolicitudesPendientes"
                type="number"
                value={config.limiteSolicitudesPendientes}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="anticipacionMaximaReserva">Anticipación Máxima de Reserva (días)</Label>
              <Input
                id="anticipacionMaximaReserva"
                name="anticipacionMaximaReserva"
                type="number"
                value={config.anticipacionMaximaReserva}
                onChange={handleInputChange}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Días Protegidos para Auditorios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {diasSemana.map((dia) => (
              <div key={dia} className="flex items-center space-x-2">
                <Switch
                  id={`dia-${dia}`}
                  checked={config.diasProtegidos.includes(dia)}
                  onCheckedChange={() => handleDiaProtegidoChange(dia)}
                />
                <Label htmlFor={`dia-${dia}`}>{dia}</Label>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notificaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="notificacionesEmail"
                checked={config.notificacionesEmail}
                onCheckedChange={handleSwitchChange}
              />
              <Label htmlFor="notificacionesEmail">Activar notificaciones por email</Label>
            </div>
            {config.notificacionesEmail && (
              <div>
                <Label htmlFor="tiempoAntelacionRecordatorio">Tiempo de antelación para recordatorios (horas)</Label>
                <Input
                  id="tiempoAntelacionRecordatorio"
                  name="tiempoAntelacionRecordatorio"
                  type="number"
                  value={config.tiempoAntelacionRecordatorio}
                  onChange={handleInputChange}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Button className="mt-6" onClick={handleGuardarConfiguracion}>Guardar Configuración</Button>
    </div>
  )
}

