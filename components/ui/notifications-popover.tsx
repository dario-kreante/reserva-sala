"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { toast } from '@/components/ui/use-toast'

interface Notificacion {
  id: number
  usuario_id: string
  tipo: 'reserva' | 'sistema' | 'alerta'
  contenido: string
  leida: boolean
  created_at: string
  updated_at: string
  ultima_actualizacion: string | null
  // Campo para control de animación
  isNew?: boolean
}

export function NotificationsPopover() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [open, setOpen] = useState(false)
  const { user } = useUser()
  const fetchInProgress = useRef(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const latestNotificationId = useRef<number | null>(null)

  // Memoizar la función fetchNotificaciones usando useCallback para evitar recreaciones
  const fetchNotificaciones = useCallback(async () => {
    if (!user || fetchInProgress.current) return
    
    fetchInProgress.current = true
    console.log('Cargando notificaciones desde la base de datos...')
    
    try {
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
      
      // Guardar el ID de la notificación más reciente para comparaciones futuras
      if (data.length > 0) {
        latestNotificationId.current = Math.max(...data.map(n => n.id))
      }
    } catch (err) {
      console.error('Error inesperado al cargar notificaciones:', err)
    } finally {
      fetchInProgress.current = false
    }
  }, [user])

  const marcarComoLeida = async (id: number) => {
    if (!user) return
    
    try {
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

      // Optimización: Actualizar el estado local sin necesidad de recargar todo
      setNotificaciones(prevState => 
        prevState.map(notif => 
          notif.id === id 
            ? { ...notif, leida: true, ultima_actualizacion: new Date().toISOString() } 
            : notif
        )
      )
      
      // Actualizar contador de no leídas
      setNoLeidas(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error inesperado al marcar notificación:', err)
      toast({
        title: "Error",
        description: "No se pudo marcar la notificación como leída",
        variant: "destructive",
      })
    }
  }

  const marcarTodasComoLeidas = async () => {
    if (!user) return
    
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ 
          leida: true,
          ultima_actualizacion: new Date().toISOString()
        })
        .eq('usuario_id', user.id)
        .eq('leida', false)

      if (error) {
        console.error('Error al marcar notificaciones:', error)
        return
      }

      // Optimización: Actualizar el estado local sin necesidad de recargar todo
      setNotificaciones(prevState => 
        prevState.map(notif => ({
          ...notif,
          leida: true,
          ultima_actualizacion: notif.leida ? notif.ultima_actualizacion : new Date().toISOString()
        }))
      )
      
      // Actualizar contador de no leídas
      setNoLeidas(0)
    } catch (err) {
      console.error('Error inesperado al marcar todas las notificaciones:', err)
      toast({
        title: "Error",
        description: "No se pudieron marcar todas las notificaciones como leídas",
        variant: "destructive",
      })
    }
  }

  // Manejador de eventos para nuevas notificaciones
  const handleNuevaNotificacion = useCallback(async (payload: any) => {
    console.log('Nueva notificación recibida:', payload.new)
    
    // Si el popover está cerrado, mostrar un toast informativo
    if (!open) {
      toast({
        title: "Nueva notificación",
        description: payload.new.contenido.substring(0, 60) + (payload.new.contenido.length > 60 ? '...' : ''),
        variant: "default",
      })
      
      // Hacer que el icono de la campana pulse brevemente
      if (bellRef.current) {
        bellRef.current.classList.add('bell-pulse')
        setTimeout(() => {
          if (bellRef.current) {
            bellRef.current.classList.remove('bell-pulse')
          }
        }, 2000)
      }
    }
    
    // Optimización: Actualizar el estado local sin necesidad de recargar todo
    const nuevaNotificacion: Notificacion = {
      ...payload.new,
      isNew: true
    }
    
    setNotificaciones(prev => [nuevaNotificacion, ...prev.slice(0, 9)])
    setNoLeidas(prev => prev + 1)
    
    // Después de un tiempo, quitar la marca de "nueva" para la animación
    setTimeout(() => {
      setNotificaciones(prev => 
        prev.map(notif => 
          notif.id === nuevaNotificacion.id 
            ? { ...notif, isNew: false } 
            : notif
        )
      )
    }, 3000)
    
    latestNotificationId.current = Math.max(latestNotificationId.current || 0, payload.new.id)
  }, [open])

  // Manejador de eventos para actualizaciones de notificaciones
  const handleActualizacionNotificacion = useCallback((payload: any) => {
    console.log('Actualización de notificación recibida:', payload.new)
    
    // Optimización: Actualizar el estado local sin necesidad de recargar todo
    setNotificaciones(prevState => 
      prevState.map(notif => 
        notif.id === payload.new.id 
          ? { ...notif, ...payload.new } 
          : notif
      )
    )
    
    // Actualizar contador de no leídas si cambió el estado de leída
    if (payload.old.leida !== payload.new.leida) {
      setNoLeidas(prev => payload.new.leida ? prev - 1 : prev + 1)
    }
  }, [])

  // Manejador de eventos para eliminaciones de notificaciones
  const handleEliminacionNotificacion = useCallback((payload: any) => {
    console.log('Eliminación de notificación recibida:', payload.old)
    
    // Optimización: Actualizar el estado local sin necesidad de recargar todo
    setNotificaciones(prevState => 
      prevState.filter(notif => notif.id !== payload.old.id)
    )
    
    // Actualizar contador de no leídas si la notificación eliminada no estaba leída
    if (!payload.old.leida) {
      setNoLeidas(prev => Math.max(0, prev - 1))
    }
  }, [])

  // Efecto para cargar notificaciones iniciales y configurar suscripciones en tiempo real
  useEffect(() => {
    if (!user) return
    
    // Cargar notificaciones iniciales
    fetchNotificaciones()
    
    // Estilos CSS para la animación de la campana y nuevas notificaciones
    const style = document.createElement('style')
    style.innerHTML = `
      .bell-pulse {
        animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.1);
        }
      }
      .notification-new {
        animation: highlightNew 3s ease-out;
      }
      @keyframes highlightNew {
        0% { background-color: rgba(59, 130, 246, 0.2); }
        100% { background-color: transparent; }
      }
    `
    document.head.appendChild(style)
    
    // Configurar canal de suscripción mejorado para notificaciones en tiempo real
    const channel = supabase
      .channel(`notificaciones-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user.id}`
        },
        handleNuevaNotificacion
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user.id}`
        },
        handleActualizacionNotificacion
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user.id}`
        },
        handleEliminacionNotificacion
      )
      .subscribe((status, err) => {
        if (status !== 'SUBSCRIBED' || err) {
          console.error('Error en la suscripción a notificaciones:', status, err)
          // Intentar reconectar si hay un error en la suscripción
          setTimeout(() => fetchNotificaciones(), 5000)
        } else {
          console.log('Suscripción a notificaciones establecida correctamente')
        }
      })

    // Limpieza al desmontar
    return () => {
      console.log('Limpiando suscripción a notificaciones')
      supabase.removeChannel(channel)
      document.head.removeChild(style)
    }
  }, [user, fetchNotificaciones, handleNuevaNotificacion, handleActualizacionNotificacion, handleEliminacionNotificacion])

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          ref={bellRef}
          variant="ghost" 
          size="icon" 
          className="relative"
        >
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
                  className={`p-4 ${!notif.leida ? 'bg-muted/30' : ''} ${getNotificationStyle(notif.tipo)} ${notif.isNew ? 'notification-new' : ''}`}
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
                          {notif.isNew && <span className="ml-2 text-xs text-blue-500 font-medium">Nueva</span>}
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