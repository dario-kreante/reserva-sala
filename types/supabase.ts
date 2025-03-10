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
          rol: 'superadmin' | 'admin' | 'profesor' | 'alumno'
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
          solicitante_nombre_completo: string | null
          institucion: string | null
          mail_externos: string | null
          telefono: string | null
          comentario: string | null
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
          solicitante_nombre_completo?: string | null
          institucion?: string | null
          mail_externos?: string | null
          telefono?: string | null
          comentario?: string | null
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
          solicitante_nombre_completo?: string | null
          institucion?: string | null
          mail_externos?: string | null
          telefono?: string | null
          comentario?: string | null
          ultima_actualizacion?: string
          updated_at?: string
        }
      }
    }
  }
}

