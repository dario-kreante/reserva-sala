import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth'; // Ajusta según tu implementación

export async function middleware(request: NextRequest) {
  // Obtener la sesión del usuario
  const session = await getSession(request);
  const path = request.nextUrl.pathname;
  
  // Verificar acceso a rutas protegidas
  if (
    (path.startsWith('/gestion-salas') || path.startsWith('/gestion-usuarios')) && 
    (!session?.user || session.user.rol !== 'superadmin')
  ) {
    // Redirigir al dashboard si no es superadmin
    const url = new URL('/dashboard', request.url);
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/gestion-salas/:path*',
    '/gestion-usuarios/:path*',
  ],
}; 