import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileQuestion,
  LogOut,
  UserCog,
  Menu,
  X,
  BarChart3,
  Briefcase,
  Trash2,
  UserX,
  FileText,
  FlaskConical,
  ChevronDown,
  ListChecks,
  UserPlus,
} from 'lucide-react';
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
  children?: NavItem[];
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
    children: [
      {
        path: '/admin/shortlisted-candidates',
        label: 'Shortlisted Candidates',
        icon: ListChecks,
        permission: 'view_candidates',
        match: ['/admin/shortlisted-candidates'],
        matchPrefix: '/admin/shortlisted-candidates/',
      },
      {
        path: '/admin/added-candidates',
        label: 'Added Candidates',
        icon: UserPlus,
        permission: 'view_candidates',
        match: ['/admin/added-candidates'],
        matchPrefix: '/admin/added-candidates/',
      },
      {
        path: '/admin/rejected-candidates',
        label: 'Rejected Candidates',
        icon: UserX,
        permission: 'view_candidates',
        match: ['/admin/rejected-candidates'],
        matchPrefix: '/admin/rejected-candidates/',
      },
      {
        path: '/admin/deleted-candidates',
        label: 'Deleted Candidates',
        icon: Trash2,
        permission: 'view_deleted_candidates',
        match: ['/admin/deleted-candidates'],
        matchPrefix: '/admin/deleted-candidates/',
      },
    ],
  },
  {
    path: '/admin/test-users',
    label: 'Test Users',
    icon: FlaskConical,
    permission: 'view_candidates',
    match: ['/admin/test-users'],
    matchPrefix: '/admin/test-users/',
  },
  {
    path: '/admin/templates',
    label: 'Templates',
    icon: FileText,
    permission: 'manage_candidates',
    match: ['/admin/templates'],
    matchPrefix: '/admin/templates/',
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

function isChildRouteActive(pathname: string, item: NavItem): boolean {
  return Boolean(item.children?.some((child) => isNavActive(pathname, child)));
}

function canSeeNavItem(
  item: NavItem,
  hasPermission: (p: string) => boolean,
  isSuperAdmin: boolean
): boolean {
  if (item.superAdminOnly) return isSuperAdmin;
  if (item.permission) return hasPermission(item.permission);
  return true;
}

export function AdminLayout({
  children,
  headerLeft,
  headerRight,
  onHeaderSearchChange,
}: {
  children: React.ReactNode;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  onHeaderSearchChange?: (query: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, hasPermission, isSuperAdmin, admin } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(() =>
    isChildRouteActive(location.pathname, allNavItems.find((i) => i.path === '/admin/candidates')!)
  );

  useEffect(() => {
    if (isChildRouteActive(location.pathname, allNavItems.find((i) => i.path === '/admin/candidates')!)) {
      setCandidatesOpen(true);
    }
  }, [location.pathname]);

  const navItems = allNavItems
    .filter((item) => canSeeNavItem(item, hasPermission, isSuperAdmin))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => canSeeNavItem(child, hasPermission, isSuperAdmin)),
    }));

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navLinkClass = (active: boolean, nested = false) =>
    `flex items-center transition-colors rounded-lg font-medium ${
      nested
        ? 'gap-2 px-2.5 py-2 text-[11px] leading-none whitespace-nowrap'
        : 'gap-3 px-3 sm:px-4 py-3 text-sm'
    } ${active ? 'bg-hurix-blue/10 text-hurix-blue' : 'text-hurix-gray hover:bg-slate-50'}`;

  const NavContent = () => (
    <>
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <Link to="/" onClick={() => setDrawerOpen(false)} className="inline-flex">
          <img src="/hurix-logo.png" alt="Hurix Digital" className="h-8" />
        </Link>
        <p className="text-xs text-hurix-gray mt-2">Admin Panel</p>
        {admin && <p className="text-xs text-hurix-charcoal mt-1 truncate">{admin.email}</p>}
      </div>
      <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(location.pathname, item);
          const hasChildren = Boolean(item.children?.length);
          const childActive = isChildRouteActive(location.pathname, item);
          const expanded = item.path === '/admin/candidates' ? candidatesOpen : false;

          if (!hasChildren) {
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setDrawerOpen(false)}
                className={navLinkClass(active)}
                aria-current={active ? 'page' : undefined}
                data-nav={item.path}
              >
                <Icon size={18} className="shrink-0" />
                {item.label}
              </Link>
            );
          }

          return (
            <div key={item.path} className="space-y-1">
              <div
                className={`flex items-center rounded-lg ${
                  active || (childActive && !expanded)
                    ? 'bg-hurix-blue/10 text-hurix-blue'
                    : 'text-hurix-gray'
                }`}
              >
                <Link
                  to={item.path}
                  onClick={() => setDrawerOpen(false)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setCandidatesOpen((open) => !open);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-50/80 rounded-lg ${
                    active ? 'text-hurix-blue' : childActive && !expanded ? 'text-hurix-blue' : 'text-hurix-gray'
                  }`}
                  aria-current={active ? 'page' : undefined}
                  data-nav={item.path}
                  title="Double-click to show or hide related pages"
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
                <button
                  type="button"
                  aria-label={expanded ? 'Hide candidate pages' : 'Show candidate pages'}
                  aria-expanded={expanded}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCandidatesOpen((open) => !open);
                  }}
                  className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-current hover:bg-slate-100"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              </div>

              {expanded && (
                <div className="ml-4 space-y-0.5 border-l border-slate-200 pl-2">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const childIsActive = isNavActive(location.pathname, child);
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setDrawerOpen(false)}
                        className={navLinkClass(childIsActive, true)}
                        aria-current={childIsActive ? 'page' : undefined}
                        data-nav={child.path}
                      >
                        <ChildIcon size={14} className="shrink-0" />
                        <span className="whitespace-nowrap">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
    <div className="h-screen flex overflow-hidden bg-hurix-light">
      <aside className="hidden lg:flex w-64 h-full bg-white border-r border-slate-100 flex-col shrink-0 overflow-hidden">
        <NavContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-xl overflow-hidden">
            <button onClick={() => setDrawerOpen(false)} className="absolute top-4 right-4 p-2 text-hurix-gray">
              <X size={20} />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="lg:hidden shrink-0 z-40 bg-white border-b border-slate-100 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawerOpen(true)} className="p-2 -ml-2 text-hurix-charcoal shrink-0">
              <Menu size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <AdminGlobalSearch onQueryChange={onHeaderSearchChange} />
            </div>
          </div>
          {(headerLeft || headerRight) && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">{headerLeft}</div>
              <div className="flex items-center gap-2 shrink-0">{headerRight}</div>
            </div>
          )}
        </header>

        <div className="hidden lg:grid shrink-0 z-30 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4 bg-hurix-light/95 backdrop-blur border-b border-slate-100 px-8 py-3">
          <div className="min-w-0 justify-self-start">{headerLeft}</div>
          <div className="w-full max-w-md justify-self-center">
            <AdminGlobalSearch onQueryChange={onHeaderSearchChange} />
          </div>
          <div className="flex items-center justify-end gap-2 justify-self-end">{headerRight}</div>
        </div>

        <main className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
