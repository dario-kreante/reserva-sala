import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutWrapper from '@/components/LayoutWrapper'
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reserva de Salas - Facultad de Psicología',
  description: 'Sistema de reserva de salas para la Facultad de Psicología - Universidad de Talca',
  keywords: ['reserva', 'salas', 'universidad', 'talca', 'psicología', 'facultad'],
  authors: [{ name: 'Universidad de Talca' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' }
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Sistema de Reserva de Salas - Universidad de Talca',
    description: 'Gestión de reservas de espacios académicos de la Facultad de Psicología',
    type: 'website',
    locale: 'es_ES',
    siteName: 'Reserva de Salas UTalca',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <LayoutWrapper>{children}</LayoutWrapper>
        <Toaster />
      </body>
    </html>
  )
}

