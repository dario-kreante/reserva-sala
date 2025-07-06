'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, testConnection, debugQuery } from '@/lib/supabase'
import { User } from '@/types/user'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Probar conexión primero
        const isConnected = await testConnection()
        console.log('Estado de conexión:', isConnected)

        const ssoId = document.cookie.replace(/(?:(?:^|.*;\s*)sso_id\s*\=\s*([^;]*).*$)|^.*$/, "$1")
        console.log('SSO ID encontrado:', ssoId, 'longitud:', ssoId.length)

        if (!ssoId) {
          console.log('❌ No hay SSO ID - redirigiendo al login')
          setLoading(false)
          router.push('/login')
          return
        }

        const rutLimpio = ssoId.replace(/[.-]/g, '').trim()
        
        // Query directo para debug
        const queryText = `
          SELECT id, nombre, apellido, email, rol, rut 
          FROM usuarios 
          WHERE rut = '${rutLimpio}' 
            AND activo = true;
        `
        
        await debugQuery(queryText)

        // Query normal con el cliente
        const { data: userData, error } = await supabase
          .from('usuarios')
          .select(`
            id,
            nombre,
            apellido,
            email,
            rol,
            rut
          `)
          .eq('rut', rutLimpio)
          .eq('activo', true)
          .maybeSingle()

        console.log('Query Supabase completo:', {
          rut: rutLimpio,
          resultado: userData,
          error,
          query: queryText,
          headers: await supabase.auth.getSession()
        })

        if (userData) {
          setUser(userData)
        } else {
          console.log('❌ No se encontró usuario con rut:', rutLimpio, '- redirigiendo al login')
          setUser(null)
          router.push('/login')
        }
      } catch (error) {
        console.error('❌ Error in useUser:', error, '- redirigiendo al login')
        setUser(null)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  return { user, loading }
}

