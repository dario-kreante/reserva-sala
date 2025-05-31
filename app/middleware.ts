import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Verificar acceso a rutas protegidas
  if (path.startsWith('/gestion-salas') || path.startsWith('/gestion-usuarios')) {
    // Aquí iría la lógica de verificación de roles
    // Por ahora, permitimos el acceso a todos
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/gestion-salas/:path*',
    '/gestion-usuarios/:path*',
  ],
}; 