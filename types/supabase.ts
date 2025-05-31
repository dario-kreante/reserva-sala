export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          email: string
          nombre: string
          apellido: string
          rol: 'superadmin' | 'admin' | 'profesor' | 'alumno' | 'administrativo'
          es_usuario_externo: boolean
          departamento: string | null
          fecha_creacion: string
          ultima_actualizacion: string
          activo: boolean
          telefono: string | null
          intentos_fallidos: number
          ultima_sesion: string | null
          token_recuperacion: string | null
          token_expiracion: string | null
          rut: string
        }
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['usuarios']['Row']>
      }
      reservas: {
        Row: {
          id: number
          usuario_id: string
          sala_id: number
          fecha: string
          hora_inicio: string
          hora_fin: string
          estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
          es_urgente: boolean
          es_externo: boolean
          es_reserva_sistema: boolean
          horario_id: number | null
          solicitante_nombre_completo: string | null
          institucion: string | null
          mail_externos: string | null
          telefono: string | null
          comentario: string | null
          nombre_modulo: string | null
          seccion: string | null
          codigo_asignatura: string | null
          profesor_responsable: string | null
          created_at?: string
          ultima_actualizacion?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          usuario_id: string
          sala_id: number
          fecha: string
          hora_inicio: string
          hora_fin: string
          estado?: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
          es_urgente?: boolean
          es_externo?: boolean
          es_reserva_sistema?: boolean
          horario_id?: number | null
          solicitante_nombre_completo?: string | null
          institucion?: string | null
          mail_externos?: string | null
          telefono?: string | null
          comentario?: string | null
          nombre_modulo?: string | null
          seccion?: string | null
          codigo_asignatura?: string | null
          profesor_responsable?: string | null
          created_at?: string
          ultima_actualizacion?: string
          updated_at?: string
        }
        Update: {
          usuario_id?: string
          sala_id?: number
          fecha?: string
          hora_inicio?: string
          hora_fin?: string
          estado?: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
          es_urgente?: boolean
          es_externo?: boolean
          es_reserva_sistema?: boolean
          horario_id?: number | null
          solicitante_nombre_completo?: string | null
          institucion?: string | null
          mail_externos?: string | null
          telefono?: string | null
          comentario?: string | null
          nombre_modulo?: string | null
          seccion?: string | null
          codigo_asignatura?: string | null
          profesor_responsable?: string | null
          ultima_actualizacion?: string
          updated_at?: string
        }
      }
      horarios: {
        Row: {
          id: number
          sala_id: number
          periodo_id: number
          fecha: string
          hora_inicio: string
          hora_fin: string
          recurrencia: 'unico' | 'semanal' | 'mensual'
          activo: boolean
          nombre_modulo: string | null
          seccion: string | null
          codigo_asignatura: string | null
          profesor_responsable: string | null
          descripcion: string | null
          created_at: string
          ultima_actualizacion: string
        }
        Insert: {
          id?: number
          sala_id: number
          periodo_id: number
          fecha: string
          hora_inicio: string
          hora_fin: string
          recurrencia: 'unico' | 'semanal' | 'mensual'
          activo?: boolean
          nombre_modulo?: string | null
          seccion?: string | null
          codigo_asignatura?: string | null
          profesor_responsable?: string | null
          descripcion?: string | null
          created_at?: string
          ultima_actualizacion?: string
        }
        Update: {
          sala_id?: number
          periodo_id?: number
          fecha?: string
          hora_inicio?: string
          hora_fin?: string
          recurrencia?: 'unico' | 'semanal' | 'mensual'
          activo?: boolean
          nombre_modulo?: string | null
          seccion?: string | null
          codigo_asignatura?: string | null
          profesor_responsable?: string | null
          descripcion?: string | null
          ultima_actualizacion?: string
        }
      }
    }
  }
}

// Tipos auxiliares para reservas con información descriptiva
export type ReservaConDescripcion = Database['public']['Tables']['reservas']['Row'] & {
  titulo_completo?: string
  sala_nombre?: string
  usuario_nombre?: string
  usuario_apellido?: string
}

export type HorarioConDescripcion = Database['public']['Tables']['horarios']['Row'] & {
  sala_nombre?: string
  periodo_nombre?: string
  reservas_generadas?: number
}

// Función auxiliar para generar título descriptivo en el frontend
export function generarTituloReserva(reserva: {
  nombre_modulo?: string | null
  profesor_responsable?: string | null
  es_reserva_sistema?: boolean
}): string {
  if (!reserva.es_reserva_sistema) {
    return 'Reserva Manual'
  }

  let titulo = ''
  
  if (reserva.nombre_modulo) {
    titulo = reserva.nombre_modulo
  }
  
  if (reserva.profesor_responsable) {
    titulo = titulo ? `${titulo} - ${reserva.profesor_responsable}` : reserva.profesor_responsable
  }
  
  return titulo || 'Reserva del Sistema'
}

