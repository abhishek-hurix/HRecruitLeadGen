import { Link } from 'react-router-dom';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = true }: HeaderProps) {
  return (
    <header className="border-b border-slate-100 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/hurix-logo.png" alt="Hurix Digital" className="h-10 sm:h-12" />
        </Link>
        {showNav && (
          <nav className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
            <Link to="/login" className="text-sm font-medium text-hurix-charcoal hover:text-hurix-blue">
              Candidate Login
            </Link>
            <Link to="/admin/login" className="text-sm font-medium text-hurix-charcoal hover:text-hurix-blue">
              Admin Login
            </Link>
            <Link to="/register" className="btn-primary text-sm px-4 py-2">
              Apply Now
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
