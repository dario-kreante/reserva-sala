export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: 'superadmin' | 'admin' | 'profesor' | 'alumno' | 'administrativo';
}

