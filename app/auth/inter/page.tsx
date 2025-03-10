'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { setCookie } from '@/lib/cookies'

export default function InterPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const v = searchParams.get('v')

  useEffect(() => {
    if (!id) {
      // Redirect to SSO login if no ID present
      const currentUrl = encodeURIComponent(window.location.href)
      window.location.href = `https://huemul.utalca.cl/sso/login.php?url=${currentUrl}`
    } else if (v) {
      // Set cookies and redirect to home
      setCookie('sso_id', id)
      setCookie('sso', 'true')
      router.push('/')
    }
  }, [id, v, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirigiendo...</p>
    </div>
  )
}

