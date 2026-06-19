import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';

export function AccessDeniedPage() {
  return (
    <AdminLayout>
      <div className="max-w-lg mx-auto card-premium text-center py-12">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <ShieldX className="text-red-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-hurix-charcoal mb-2">403 Access Denied</h1>
        <p className="text-hurix-gray mb-8">You do not have permission to access this page.</p>
        <Link to="/admin/dashboard" className="btn-primary inline-block">
          Back to Dashboard
        </Link>
      </div>
    </AdminLayout>
  );
}
