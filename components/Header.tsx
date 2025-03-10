'use client'

import { Bell, UserIcon, LogOut, Menu } from 'lucide-react'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from 'next/navigation'
import { deleteCookie } from '@/lib/cookies'
import { useUser } from '@/hooks/useUser'
import { NotificationsPopover } from "@/components/ui/notifications-popover"
import Link from 'next/link'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Sidebar from './Sidebar'

const Header = () => {
  const router = useRouter()
  const { user, loading } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  console.log('Estado actual del usuario:', { user, loading }) // Debug

  const handleLogout = () => {
    deleteCookie('sso')
    deleteCookie('sso_id')
    router.push('/login')
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-blue-800 text-white">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <Link href="/" className="text-xl font-bold">
              Gestión de Salas - Psicología
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationsPopover />
            {!loading && user && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <UserIcon size={20} />
                      <span className="hidden md:inline">
                        {user.nombre} {user.apellido} ({user.rol})
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

