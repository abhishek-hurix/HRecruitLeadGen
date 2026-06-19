import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardCheck, TrendingUp, CheckCircle, Play, Send, UserCog } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getDashboard } from '../../api/admin';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="card-premium p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-hurix-gray truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-hurix-charcoal mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="text-white" size={22} />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { isSuperAdmin, isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', isSuperAdmin],
    queryFn: getDashboard,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login', { state: { from: location.pathname }, replace: true });
    }
  }, [loading, isAuthenticated, navigate, location.pathname]);

  return (
    <AdminLayout>
      <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal mb-6 sm:mb-8">Dashboard</h1>
      {isLoading ? (
        <p className="text-hurix-gray">Loading metrics...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Total Candidates" value={data?.totalCandidates || 0} icon={Users} color="bg-hurix-blue" />
            <MetricCard title="Completed" value={data?.completedAssessments || 0} icon={ClipboardCheck} color="bg-hurix-purple" />
            <MetricCard title="Avg Score" value={data?.averageScore || '0'} icon={TrendingUp} color="bg-orange-500" />
            {isSuperAdmin && (
              <>
                <MetricCard title="Verified" value={data?.verified ?? 0} icon={CheckCircle} color="bg-blue-500" />
                <MetricCard title="Started Assessment" value={data?.startedAssessment ?? 0} icon={Play} color="bg-amber-500" />
                <MetricCard title="Submitted Assessment" value={data?.submittedAssessment ?? 0} icon={Send} color="bg-green-500" />
                <MetricCard title="Total Admins" value={data?.totalAdmins ?? 0} icon={UserCog} color="bg-indigo-600" />
              </>
            )}
          </div>

          {isSuperAdmin && data?.candidatesByExperience && data.candidatesByExperience.length > 0 && (
            <div className="mt-8 card-premium p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-hurix-charcoal mb-4">Candidates by Experience</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {data.candidatesByExperience.map((item) => (
                  <div key={item.category} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm">
                    <span className="text-hurix-gray">{item.category}</span>
                    <span className="font-bold text-hurix-charcoal">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
