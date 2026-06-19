import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { getCandidateToken } from '../../api/client';

interface AdminRouteProps {
  children: React.ReactNode;
  permission?: string;
}

export function AdminRoute({ children, permission }: AdminRouteProps) {
  const { loading, isAuthenticated, hasPermission } = useAdminAuth();
  const location = useLocation();

  if (getCandidateToken()) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin/access-denied" replace />;
  }

  return <>{children}</>;
}

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isSuperAdmin } = useAdminAuth();
  const location = useLocation();

  if (getCandidateToken()) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/admin/access-denied" replace />;
  }

  return <>{children}</>;
}
