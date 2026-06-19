import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clearCandidateToken } from '../../api/client';

interface CandidateLayoutProps {
  candidateName: string;
  children: React.ReactNode;
  onLogout?: () => void;
}

export function CandidateLayout({ candidateName, children, onLogout }: CandidateLayoutProps) {
  const handleLogout = () => {
    clearCandidateToken();
    onLogout?.();
  };

  return (
    <div className="min-h-screen bg-hurix-light flex flex-col">
      <header className="border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img src="/hurix-logo.png" alt="Hurix Digital" className="h-9 sm:h-10" />
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <span className="text-sm font-medium text-hurix-charcoal truncate max-w-[140px] sm:max-w-none">
              {candidateName}
            </span>
            <button
              onClick={handleLogout}
              className="btn-secondary text-sm px-3 py-2 flex items-center gap-2 shrink-0"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
