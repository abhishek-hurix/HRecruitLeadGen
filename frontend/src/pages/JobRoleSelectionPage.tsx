import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, DollarSign, Loader2, Briefcase } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { MobileAssessmentBlocker } from '../components/assessment/MobileAssessmentBlocker';
import { isMobilePhone } from '../utils/device';
import { useAssessmentToken } from '../hooks/useAssessmentToken';
import { initSessionAuth, getJobRoles, selectRoleAndStart } from '../api/assessment';
import { getApiErrorMessage, isLinkExpiredError } from '../utils/apiErrors';

interface JobRoleCard {
  id: string;
  title: string;
  country: string;
  compensation: string;
  skills: string[];
  description: string | null;
  openPositions: number;
}

export function JobRoleSelectionPage() {
  const token = useAssessmentToken();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<JobRoleCard[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/expired');
      return;
    }
    initSessionAuth(token);
    getJobRoles()
      .then(setRoles)
      .catch((err) => {
        if (isLinkExpiredError(err)) navigate('/expired');
        else setError(getApiErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const handleApply = async (roleId: string) => {
    if (!token) return;
    setStartingId(roleId);
    setError('');
    try {
      await selectRoleAndStart(roleId);
      navigate(`/assessment?token=${encodeURIComponent(token)}`);
    } catch (err) {
      if (isLinkExpiredError(err)) {
        navigate('/expired');
        return;
      }
      setError(getApiErrorMessage(err, 'Failed to start assessment.'));
      setStartingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hurix-light">
        <Loader2 className="animate-spin text-hurix-blue" size={40} />
      </div>
    );
  }

  if (isMobilePhone()) return <MobileAssessmentBlocker />;

  return (
    <div className="min-h-screen bg-hurix-light">
      <Header showNav={false} />
      <main className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        <div className="text-center mb-10">
          <p className="text-hurix-blue font-semibold text-sm uppercase tracking-wide mb-2">
            Hurix Talent Assessment
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-hurix-charcoal mb-3">
            Select Your Position
          </h1>
          <p className="text-hurix-gray max-w-2xl mx-auto">
            Choose the role you are applying for. This selection is permanent and determines your
            assessment question bank.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-3xl mx-auto">
            {error}
          </div>
        )}

        {roles.length === 0 ? (
          <div className="card-premium text-center max-w-lg mx-auto">
            <Briefcase className="mx-auto text-hurix-gray mb-4" size={40} />
            <p className="text-hurix-gray">No open positions at this time. Please check back later.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {roles.map((role) => (
              <article key={role.id} className="card-premium flex flex-col h-full">
                <h2 className="text-xl font-bold text-hurix-charcoal mb-4">{role.title}</h2>

                <div className="space-y-3 text-sm flex-1">
                  <div className="flex items-start gap-2 text-hurix-gray">
                    <MapPin size={16} className="shrink-0 mt-0.5 text-hurix-blue" />
                    <div>
                      <span className="font-medium text-hurix-charcoal">Country: </span>
                      {role.country}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-hurix-gray">
                    <DollarSign size={16} className="shrink-0 mt-0.5 text-hurix-blue" />
                    <div>
                      <span className="font-medium text-hurix-charcoal">Compensation: </span>
                      {role.compensation}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-hurix-charcoal mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {role.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 bg-hurix-blue/10 text-hurix-blue text-xs font-medium rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  {role.description && (
                    <p className="text-hurix-gray text-sm leading-relaxed pt-1">{role.description}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleApply(role.id)}
                  disabled={startingId !== null}
                  className="btn-primary w-full mt-6 py-3 disabled:opacity-60"
                >
                  {startingId === role.id ? (
                    <Loader2 className="animate-spin mx-auto" size={20} />
                  ) : (
                    'Apply & Start Assessment'
                  )}
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
