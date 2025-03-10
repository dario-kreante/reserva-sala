import ProtectedRoute from '@/components/protected-route';
import GestionUsuariosContent from '@/components/gestion-usuarios-content';

const GestionUsuariosPage = () => {
  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <GestionUsuariosContent />
    </ProtectedRoute>
  );
};

export default GestionUsuariosPage; 