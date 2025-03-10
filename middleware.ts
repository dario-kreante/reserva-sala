import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request: NextRequest) {
  // No verificar auth para la página inter y login
  if (request.nextUrl.pathname === '/auth/inter' || request.nextUrl.pathname === '/login') {
    return NextResponse.next()
  }

  const sso = request.cookies.get('sso')
  const ssoId = request.cookies.get('sso_id')

  // Verificar si la sesión está activa
  if (!sso || !ssoId) {
    // Redirigir a la página de login que manejará el flujo SSO
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Crear cliente de Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Obtener el usuario de Supabase
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('rut', ssoId.value)
    .single()

  // Si hay un error o no se encuentra el usuario, redirigir al login
  if (error || !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Definir rutas permitidas para cada rol
  const allowedRoutes = {
    superadmin: ['/', '/gestion-salas', '/gestion-horarios', '/reservas', '/aprobaciones', '/usuarios', '/configuracion'],
    admin: ['/', '/gestion-horarios', '/reservas', '/aprobaciones'],
    profesor: ['/mis-reservas'],
    alumno: ['/mis-reservas'],
  }

  // Verificar si el usuario tiene acceso a la ruta solicitada
  const path = request.nextUrl.pathname
  if (user.rol !== 'superadmin' && user.rol !== 'admin' && path === '/') {
    // Redirigir usuarios no admin a /mis-reservas cuando intentan acceder al dashboard
    return NextResponse.redirect(new URL('/mis-reservas', request.url))
  }

  // Redirección específica para rutas protegidas de superadmin
  if ((path.startsWith('/gestion-salas') || path.startsWith('/gestion-usuarios') || path === '/usuarios') && user.rol !== 'superadmin') {
    // Redirigir a la página principal permitida para su rol
    return NextResponse.redirect(new URL(allowedRoutes[user.rol as keyof typeof allowedRoutes][0], request.url))
  }

  if (!allowedRoutes[user.rol as keyof typeof allowedRoutes].includes(path)) {
    // Si no tiene acceso, redirigir a la página principal permitida para su rol
    return NextResponse.redirect(new URL(allowedRoutes[user.rol as keyof typeof allowedRoutes][0], request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

