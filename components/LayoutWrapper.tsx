'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useUser } from '@/hooks/useUser'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useUser()
  const router = useRouter()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (!loading && user && !isLoginPage) {
      if (user.rol !== 'superadmin' && user.rol !== 'admin' && pathname === '/') {
        router.push('/mis-reservas')
      }
    }
  }, [user, loading, pathname, router, isLoginPage])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (loading) {
    return <div>Cargando...</div>
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="hidden md:block">
        <Sidebar className="w-64 h-full absolute inset-y-0 left-0 md:relative" />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          {children}
        </main>
      </div>
    </div>
  )
}

