import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getAdminToken, clearAdminToken, setAdminToken } from '../api/client';
import { getAdminMe } from '../api/admin';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

export interface AdminSession {
  id: string;
  email: string;
  role: AdminRole;
  permissions: string[];
}

interface AdminAuthContextValue {
  admin: AdminSession | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, admin: AdminSession) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isSuperAdmin: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearAdminToken();
    setAdmin(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getAdminMe();
      setAdmin({
        id: me.id,
        email: me.email,
        role: me.role,
        permissions: me.permissions,
      });
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((token: string, session: AdminSession) => {
    setAdminToken(token);
    setAdmin(session);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => admin?.permissions.includes(permission) ?? false,
    [admin]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        isAuthenticated: Boolean(admin),
        login,
        logout,
        refresh,
        hasPermission,
        isSuperAdmin: admin?.role === 'SUPER_ADMIN',
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
