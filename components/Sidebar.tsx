import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { Home, Calendar, Users, BookOpen, Clock, CheckSquare, Settings } from 'lucide-react'

interface SidebarProps {
  className?: string;
}

const Sidebar = ({ className = "" }: SidebarProps) => {
  const { user } = useUser()

  const adminLinks = [
    { href: "/", icon: Home, text: "Inicio" },
    { href: "/gestion-horarios", icon: Clock, text: "Gestión de Horarios" },
    { href: "/reservas", icon: Calendar, text: "Reservas de Salas" },
    { href: "/aprobaciones", icon: CheckSquare, text: "Aprobaciones" },
  ]

  const superAdminLinks = [
    ...adminLinks,
    { href: "/gestion-salas", icon: BookOpen, text: "Gestión de Salas" },
    { href: "/usuarios", icon: Users, text: "Gestión de Usuarios" },
    { href: "/configuracion", icon: Settings, text: "Configuración" },
  ]

  const userLinks = [
    { href: "/mis-reservas", icon: Calendar, text: "Mis Reservas" },
  ]

  const links = user?.rol === 'superadmin' ? superAdminLinks : 
                user?.rol === 'admin' ? adminLinks : 
                userLinks

  return (
    <div className={`bg-blue-800 text-white w-full h-full flex flex-col ${className}`}>
      {/* Contenido principal del sidebar */}
      <div className="flex-1 space-y-6 py-7 px-2">
        <div className="px-4 py-2">
          <h2 className="text-xl font-bold mb-6">Menú</h2>
        </div>
        <nav>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="block py-2.5 px-4 rounded transition duration-200 hover:bg-blue-700 hover:text-white">
              <link.icon className="inline-block mr-2" size={20} />
              {link.text}
            </Link>
          ))}
        </nav>
      </div>
      
      {/* Footer con logo institucional */}
      <div className="p-4 border-t border-blue-700 bg-blue-900/50">
        <div className="flex flex-col items-center justify-center space-y-2">
          {/* Información adicional */}
          <div className="text-center">
            <p className="text-xs text-blue-100 font-medium">
              Sistema de Reserva de Salas
            </p>
            <p className="text-xs text-blue-200/70">
              © 2024 - Facultad de Psicología
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar

