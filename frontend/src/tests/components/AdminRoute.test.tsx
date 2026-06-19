import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from '../../components/guards/AdminRoute';

const mockUseAdminAuth = vi.fn();

vi.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

vi.mock('../../api/client', () => ({
  getCandidateToken: () => null,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader">Loading</div>,
}));

function renderAdminRoute(permission?: string) {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <Routes>
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute permission={permission}>
              <div>Protected Content</div>
            </AdminRoute>
          }
        />
        <Route path="/admin/login" element={<div>Login Page</div>} />
        <Route path="/admin/access-denied" element={<div>Access Denied</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRoute guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to login', async () => {
    mockUseAdminAuth.mockReturnValue({
      loading: false,
      isAuthenticated: false,
      hasPermission: () => false,
    });

    renderAdminRoute();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when authenticated with permission', () => {
    mockUseAdminAuth.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      hasPermission: () => true,
    });

    renderAdminRoute('view_dashboard');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows loader while auth is loading', () => {
    mockUseAdminAuth.mockReturnValue({
      loading: true,
      isAuthenticated: false,
      hasPermission: () => false,
    });

    renderAdminRoute();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });
});
