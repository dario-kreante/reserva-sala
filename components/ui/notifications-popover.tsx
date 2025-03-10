"use client"

import { useState, useEffect } from 'react'
import { Bell, Info, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Notificacion {
  id: number
  usuario_id: string
  tipo: 'reserva' | 'sistema' | 'alerta'
  contenido: string
  leida: boolean
  created_at: string
  updated_at: string
  ultima_actualizacion: string | null
}

export function NotificationsPopover() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const { user } = useUser()

  const fetchNotificaciones = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error al cargar notificaciones:', error)
      return
    }

    setNotificaciones(data)
    setNoLeidas(data.filter(n => !n.leida).length)
  }

  const marcarComoLeida = async (id: number) => {
    const { error } = await supabase
      .from('notificaciones')
      .update({ 
        leida: true,
        ultima_actualizacion: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error al marcar notificación:', error)
      return
    }

    fetchNotificaciones()
  }

  const marcarTodasComoLeidas = async () => {
    const { error } = await supabase
      .from('notificaciones')
      .update({ 
        leida: true,
        ultima_actualizacion: new Date().toISOString()
      })
      .eq('usuario_id', user?.id)
      .eq('leida', false)

    if (error) {
      console.error('Error al marcar notificaciones:', error)
      return
    }

    fetchNotificaciones()
  }

  useEffect(() => {
    fetchNotificaciones()
    
    // Suscribirse a nuevas notificaciones
    const channel = supabase
      .channel('notificaciones')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user?.id}`
        },
        () => {
          fetchNotificaciones()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'reserva':
        return <Calendar className="h-4 w-4 text-blue-500" />
      case 'sistema':
        return <Info className="h-4 w-4 text-green-500" />
      case 'alerta':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getNotificationStyle = (tipo: string) => {
    switch (tipo) {
      case 'reserva':
        return 'border-l-2 border-l-blue-500'
      case 'sistema':
        return 'border-l-2 border-l-green-500'
      case 'alerta':
        return 'border-l-2 border-l-red-500'
      default:
        return ''
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {noLeidas > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {noLeidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificaciones</h4>
          {noLeidas > 0 && (
            <Button 
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
              onClick={marcarTodasComoLeidas}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notificaciones.length > 0 ? (
            <div className="divide-y">
              {notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 ${!notif.leida ? 'bg-muted/30' : ''} ${getNotificationStyle(notif.tipo)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notif.tipo)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium">
                          {notif.tipo === 'reserva' ? 
                            notif.tipo.replace('_', ' ').split('_')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ') 
                            : notif.tipo.charAt(0).toUpperCase() + notif.tipo.slice(1)
                          }
                        </p>
                        {!notif.leida && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 ml-2"
                            onClick={() => marcarComoLeida(notif.id)}
                          >
                            Marcar como leída
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {notif.contenido}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: es
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No hay notificaciones
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
} 