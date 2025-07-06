"use client"

import { useEffect, useState } from 'react'
import { useUser } from '@/hooks/useUser'
import { useReservasData } from '@/hooks/useReservasData'
import { useResponsableSalas } from '@/hooks/useResponsableSalas'

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  
  // Hooks
  const userHook = useUser()
  const reservasHook = useReservasData()
  const salasResponsableHook = useResponsableSalas()

  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo({
        timestamp: new Date().toISOString(),
        user: {
          loading: userHook.loading,
          user: userHook.user,
          userExists: !!userHook.user,
          userRole: userHook.user?.rol
        },
        reservas: {
          loading: reservasHook.loading,
          reservasCount: reservasHook.reservas.length,
          salasCount: reservasHook.salas.length,
          error: reservasHook.error
        },
        salasResponsable: {
          loading: salasResponsableHook.loading,
          salasCount: salasResponsableHook.salasResponsable.length,
          esSuperAdmin: salasResponsableHook.esSuperAdmin,
          esAdmin: salasResponsableHook.esAdmin,
          puedeVerTodo: salasResponsableHook.puedeVerTodo,
          error: salasResponsableHook.error
        },
        cookies: document.cookie,
        ssoId: document.cookie.replace(/(?:(?:^|.*;\s*)sso_id\s*\=\s*([^;]*).*$)|^.*$/, "$1")
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [userHook, reservasHook, salasResponsableHook])

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🔍 Debug Dashboard</h1>
      
      <div className="space-y-6">
        {/* Estado de Hooks */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Estados de Hooks</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* useUser */}
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-bold text-blue-900">useUser</h3>
              <p className={`text-sm ${userHook.loading ? 'text-red-600' : 'text-green-600'}`}>
                Loading: {userHook.loading.toString()}
              </p>
              <p className="text-sm">User exists: {(!!userHook.user).toString()}</p>
              <p className="text-sm">Role: {userHook.user?.rol || 'N/A'}</p>
              <p className="text-sm">Name: {userHook.user ? `${userHook.user.nombre} ${userHook.user.apellido}` : 'N/A'}</p>
            </div>

            {/* useReservasData */}
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-bold text-green-900">useReservasData</h3>
              <p className={`text-sm ${reservasHook.loading ? 'text-red-600' : 'text-green-600'}`}>
                Loading: {reservasHook.loading.toString()}
              </p>
              <p className="text-sm">Reservas: {reservasHook.reservas.length}</p>
              <p className="text-sm">Salas: {reservasHook.salas.length}</p>
              <p className="text-sm">Error: {reservasHook.error || 'None'}</p>
            </div>

            {/* useResponsableSalas */}
            <div className="bg-purple-50 p-4 rounded">
              <h3 className="font-bold text-purple-900">useResponsableSalas</h3>
              <p className={`text-sm ${salasResponsableHook.loading ? 'text-red-600' : 'text-green-600'}`}>
                Loading: {salasResponsableHook.loading.toString()}
              </p>
              <p className="text-sm">Salas: {salasResponsableHook.salasResponsable.length}</p>
              <p className="text-sm">Es SuperAdmin: {salasResponsableHook.esSuperAdmin.toString()}</p>
              <p className="text-sm">Es Admin: {salasResponsableHook.esAdmin.toString()}</p>
              <p className="text-sm">Error: {salasResponsableHook.error?.message || 'None'}</p>
            </div>
          </div>
        </div>

        {/* Cookies y SSO */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Autenticación</h2>
          <div className="space-y-2">
            <p><strong>SSO ID:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{debugInfo.ssoId || 'No encontrado'}</code></p>
            <p><strong>Cookies:</strong></p>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {debugInfo.cookies || 'No cookies'}
            </pre>
          </div>
        </div>

        {/* Estado Detallado */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Estado Completo (JSON)</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        {/* Acciones de Debug */}
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Acciones de Debug</h2>
          <div className="space-x-4">
            <button 
              onClick={() => window.location.reload()} 
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Recargar Página
            </button>
            <button 
              onClick={() => {
                document.cookie = "sso_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                window.location.reload();
              }} 
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Limpiar SSO y Recargar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 