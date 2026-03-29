import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useEffect } from 'react';
import styles from './AdminRoute.module.css';

export function AdminRoute() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const isNotAdmin = !isLoading && !!user && user.role !== 'ADMIN';

  useEffect(() => {
    if (isNotAdmin) toast('Access denied', 'error');
  }, [isNotAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className={styles.spinnerWrap}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/login" replace />;

  return <Outlet />;
}
