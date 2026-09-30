import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute({ children }) {
  const { user, isTrainer, initializing, verificandoRol } = useAuth();

  if (initializing) {
    return <LoadingScreen etapa={verificandoRol ? 1 : 0} />;
  }

  if (!user || !isTrainer) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
