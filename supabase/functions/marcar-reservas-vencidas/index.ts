// @ts-ignore: Deno global
declare const Deno: any;

// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore: ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReservaVencida {
  reserva_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  sala: string;
  usuario: string;
  fecha_creacion: string;
  fecha_vencimiento: string;
}

interface MarcadoResult {
  reservas_actualizadas: number;
  detalles: ReservaVencida[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validar método HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }), 
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar autorización
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Inicializar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🚀 Iniciando proceso de marcado de reservas vencidas:', new Date().toISOString())

    // Ejecutar la función de marcado de reservas vencidas
    const { data: resultado, error: funcionError } = await supabaseClient
      .rpc('marcar_reservas_vencidas')

    if (funcionError) {
      console.error('❌ Error ejecutando marcar_reservas_vencidas:', funcionError)
      throw funcionError
    }

    console.log('✅ Función ejecutada exitosamente:', resultado)

    // Parsear el resultado
    const reservasActualizadas = resultado?.[0]?.reservas_actualizadas || 0
    const detallesJson = resultado?.[0]?.detalles || []
    
    // Registrar en logs del sistema
    const logEntry = {
      tipo_operacion: 'edge_function_reservas_vencidas',
      descripcion: `Procesamiento automático vía Edge Function completado. ${reservasActualizadas} reservas marcadas como vencidas.`,
      detalles: detallesJson,
      fecha_creacion: new Date().toISOString()
    }

    const { error: logError } = await supabaseClient
      .from('logs_sistema')
      .insert(logEntry)

    if (logError) {
      console.error('⚠️ Error registrando log (no crítico):', logError)
    }

    // Preparar respuesta
    const response: MarcadoResult = {
      reservas_actualizadas: reservasActualizadas,
      detalles: detallesJson
    }

    console.log('📊 Resultado final:', {
      reservasActualizadas,
      totalDetalles: detallesJson.length,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Proceso completado. ${reservasActualizadas} reservas marcadas como vencidas.`,
        data: response,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('💥 Error en Edge Function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 