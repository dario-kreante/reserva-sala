'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const sso = document.cookie.includes('sso=true')
    const ssoId = document.cookie.includes('sso_id=')
    if (sso && ssoId) {
      router.push('/')
    }
  }, [router])

  const handleSSOLogin = () => {
    const currentUrl = encodeURIComponent(`${window.location.origin}/auth/inter`)
    window.location.href = `https://huemul.utalca.cl/sso/login.php?url=${currentUrl}`
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Accede a la gestión de salas de Psicología</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleSSOLogin}>
            Iniciar sesión con SSO UTalca
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

