import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug de variables de entorno
console.log('Variables de entorno:', {
  url: supabaseUrl ? 'Presente' : 'No presente',
  anonKey: supabaseAnonKey ? 'Presente' : 'No presente',
})

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables de entorno de Supabase no configuradas correctamente')
}

// Crear el cliente con ANON key
const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
)

// Función de prueba para verificar la conexión
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('fecha_creacion', { ascending: false })

    if (error) {
      console.error('Error de conexión:', error)
      console.error('Detalles del error:', {
        mensaje: error.message,
        detalles: error.details,
        hint: error.hint
      })
      return false
    }

    console.log('Lista de usuarios en la base de datos:', data)
    console.log('Total usuarios encontrados:', data?.length || 0)

    // Consulta específica para el usuario con RUT 16998654
    const { data: usuarioEspecifico, error: errorEspecifico } = await supabase
      .from('usuarios')
      .select('*')
      .eq('rut', '16998654')
      .single()

    console.log('Búsqueda específica:', {
      usuario: usuarioEspecifico,
      error: errorEspecifico
    })

    return true
  } catch (err) {
    console.error('Error al probar conexión:', err)
    return false
  }
}

// Exportar cliente con función de debug
export { supabase }

// Función helper para debug de queries
export async function debugQuery(query: string) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('rut', '16998654')

    console.log('Debug Query Result:', { 
      data, 
      error,
      totalEncontrados: data?.length || 0,
      primerUsuario: data?.[0] || null
    })
    return { data, error }
  } catch (err) {
    console.error('Error en debug query:', err)
    return { data: null, error: err }
  }
}

