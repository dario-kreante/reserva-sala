"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export function DisponibilidadDebug() {
  const [salaId, setSalaId] = useState<string>('')
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString())
  const [mes, setMes] = useState<string>((new Date().getMonth() + 1).toString())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  const handleTest = async () => {
    if (!salaId || !anio || !mes) {
      setError('Por favor, completa todos los campos')
      return
    }
    
    setLoading(true)
    setError(null)
    setResult(null)
    
    try {
      console.log(`Probando función con sala_id=${salaId}, anio=${anio}, mes=${mes}`)
      
      // Probar la función básica
      const { data: basicData, error: basicError } = await supabase
        .rpc('obtener_disponibilidad_sala_mes', {
          p_sala_id: parseInt(salaId),
          p_anio: parseInt(anio),
          p_mes: parseInt(mes)
        })
      
      if (basicError) {
        console.error('Error en función básica:', basicError)
        throw new Error(`Error en función básica: ${basicError.message}`)
      }
      
      // Probar la función v2
      const { data: v2Data, error: v2Error } = await supabase
        .rpc('obtener_disponibilidad_sala_mes_v2', {
          p_sala_id: parseInt(salaId),
          p_anio: parseInt(anio),
          p_mes: parseInt(mes)
        })
      
      if (v2Error) {
        console.error('Error en función v2:', v2Error)
        throw new Error(`Error en función v2: ${v2Error.message}`)
      }
      
      // Probar la función JSON
      const { data: jsonData, error: jsonError } = await supabase
        .rpc('obtener_disponibilidad_sala_mes_json', {
          p_sala_id: parseInt(salaId),
          p_anio: parseInt(anio),
          p_mes: parseInt(mes)
        })
      
      if (jsonError) {
        console.error('Error en función JSON:', jsonError)
        throw new Error(`Error en función JSON: ${jsonError.message}`)
      }
      
      setResult({
        basic: basicData,
        v2: v2Data,
        json: jsonData
      })
      
    } catch (err: any) {
      console.error('Error al probar funciones:', err)
      setError(err.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Depuración de Disponibilidad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sala-id">ID de Sala</Label>
              <Input 
                id="sala-id" 
                value={salaId} 
                onChange={(e) => setSalaId(e.target.value)}
                placeholder="Ej: 1"
              />
            </div>
            <div>
              <Label htmlFor="anio">Año</Label>
              <Input 
                id="anio" 
                value={anio} 
                onChange={(e) => setAnio(e.target.value)}
                placeholder="Ej: 2023"
              />
            </div>
            <div>
              <Label htmlFor="mes">Mes (1-12)</Label>
              <Input 
                id="mes" 
                value={mes} 
                onChange={(e) => setMes(e.target.value)}
                placeholder="Ej: 5"
              />
            </div>
          </div>
          
          <Button onClick={handleTest} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Probar Funciones
          </Button>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}
          
          {result && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Resultados:</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <h4 className="font-medium">Función Básica:</h4>
                    <pre className="p-2 bg-gray-100 rounded-md overflow-auto max-h-40 text-xs">
                      {JSON.stringify(result.basic, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-medium">Función V2:</h4>
                    <pre className="p-2 bg-gray-100 rounded-md overflow-auto max-h-40 text-xs">
                      {JSON.stringify(result.v2, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-medium">Función JSON:</h4>
                    <pre className="p-2 bg-gray-100 rounded-md overflow-auto max-h-40 text-xs">
                      {JSON.stringify(result.json, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 