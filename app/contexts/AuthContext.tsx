import React, { createContext, useContext, useState, useEffect } from 'react';

// Definir el tipo de usuario
type UserType = {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'superadmin' | 'admin' | 'profesor' | 'alumno';
  rut: string;
};

// Definir el tipo del contexto
type AuthContextType = {
  user: UserType | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

// Crear el contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Proveedor del contexto
export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar sesión al cargar
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Aquí implementarías la lógica para verificar la sesión
        // Por ejemplo, una llamada a tu API
        setLoading(false);
      } catch (error) {
        console.error('Error al verificar sesión:', error);
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Función de login
  const login = async (email: string, password: string) => {
    // Implementar lógica de login
  };

  // Función de logout
  const logout = async () => {
    // Implementar lógica de logout
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}; 