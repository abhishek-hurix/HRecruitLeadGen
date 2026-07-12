import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileQuestion, LogOut, UserCog, Menu, X, BarChart3, Briefcase, Trash2 } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { AdminGlobalSearch } from '../admin/AdminGlobalSearch';

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  superAdminOnly?: boolean;
  match?: string[];
  matchPrefix?: string;
};

const allNavItems: NavItem[] = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard', match: ['/admin/dashboard'] },
  {
    path: '/admin/candidates',
    label: 'Candidates',
    icon: Users,
    permission: 'view_candidates',
    match: ['/admin/candidates', '/admin/candidates/new'],
    matchPrefix: '/admin/candidates/',
  },
  {
    path: '/admin/deleted-candidates',
    label: 'Deleted Candidates',
    icon: Trash2,
    permission: 'view_deleted_candidates',
    match: ['/admin/deleted-candidates'],
    matchPrefix: '/admin/deleted-candidates/',
  },
  { path: '/admin/job-roles', label: 'Job Roles', icon: Briefcase, permission: 'view_job_roles', match: ['/admin/job-roles'], matchPrefix: '/admin/job-roles/' },
  { path: '/admin/questions', label: 'Questions', icon: FileQuestion, permission: 'manage_questions', match: ['/admin/questions'] },
  { path: '/admin/analytics', label: 'Marketing Analytics', icon: BarChart3, superAdminOnly: true, match: ['/admin/analytics'] },
  { path: '/admin/users', label: 'Admin Users', icon: UserCog, superAdminOnly: true, match: ['/admin/users'] },
];

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match?.includes(pathname)) return true;
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true;
  return false;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, hasPermission, isSuperAdmin, admin } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = allNavItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.permission) return hasPermission(item.permission);
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const NavContent = () => (
    <>
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <Link to="/" onClick={() => setDrawerOpen(false)} className="inline-flex">
          <img src="/hurix-logo.png" alt="Hurix Digital" className="h-8" />
        </Link>
        <p className="text-xs text-hurix-gray mt-2">Admin Panel</p>
        {admin && <p className="text-xs text-hurix-charcoal mt-1 truncate">{admin.email}</p>}
      </div>
      <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(location.pathname, item);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-3 sm:px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-hurix-blue/10 text-hurix-blue' : 'text-hurix-gray hover:bg-slate-50'
              }`}
              aria-current={active ? 'page' : undefined}
              data-nav={item.path}
            >
              <Icon size={18} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-6 py-4 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-slate-100"
      >
        <LogOut size={18} />
        Logout
      </button>
    </>
  );

  return (
    <div className="min-h-screen flex bg-hurix-light">
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-100 flex-col shrink-0">
        <NavContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-xl">
            <button onClick={() => setDrawerOpen(false)} className="absolute top-4 right-4 p-2 text-hurix-gray">
              <X size={20} />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-2">
          <button onClick={() => setDrawerOpen(true)} className="p-2 -ml-2 text-hurix-charcoal shrink-0">
            <Menu size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <AdminGlobalSearch />
          </div>
        </header>
        <div className="hidden lg:flex sticky top-0 z-30 bg-hurix-light/95 backdrop-blur border-b border-slate-100 px-8 py-3">
          <AdminGlobalSearch />
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
