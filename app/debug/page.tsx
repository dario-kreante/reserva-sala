import { DisponibilidadDebug } from "@/components/ui/disponibilidad-debug"

export default function DebugPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Página de Depuración</h1>
      
      <div className="space-y-8">
        <DisponibilidadDebug />
      </div>
    </div>
  )
} 