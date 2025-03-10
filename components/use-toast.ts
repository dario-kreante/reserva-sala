import { useState, useEffect, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now()
    setToasts((prevToasts) => [...prevToasts, { id, message, type }])
    return id
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setToasts((prevToasts) => prevToasts.slice(1))
    }, 3000)

    return () => clearInterval(timer)
  }, [toasts])

  return { addToast, removeToast, toasts }
}

export function toast(message: string, type: ToastType = 'info') {
  const { addToast } = useToast()
  addToast(message, type)
}

