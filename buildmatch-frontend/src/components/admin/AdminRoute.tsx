import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute — protects every /admin/* page.
 * - Unauthenticated  → /login
 * - Authenticated but not ADMIN → /dashboard (403 redirect)
 * - ADMIN            → renders children
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user)              return <Navigate to="/login"     replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
