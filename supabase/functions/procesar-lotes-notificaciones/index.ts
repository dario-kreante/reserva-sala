import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚀 Iniciando procesamiento de lotes de notificaciones...')

    // Llamar a la función de procesamiento de lotes
    const { data, error } = await supabaseClient.rpc('procesar_lotes_notificaciones')

    if (error) {
      console.error('❌ Error al procesar lotes:', error)
      throw error
    }

    const lotesProcessados = data || 0
    console.log(`✅ Lotes procesados: ${lotesProcessados}`)

    // Si se procesaron lotes, también limpiar los expirados
    if (lotesProcessados > 0) {
      const { data: limpiezaData, error: limpiezaError } = await supabaseClient.rpc('limpiar_lotes_expirados')
      
      if (!limpiezaError) {
        console.log(`🧹 Lotes expirados eliminados: ${limpiezaData || 0}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Procesados ${lotesProcessados} lotes de notificaciones`,
        processed_batches: lotesProcessados,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Error general en procesamiento de lotes:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500,
      }
    )
  }
}) 