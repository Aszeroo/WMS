import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function AdminRoute() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
