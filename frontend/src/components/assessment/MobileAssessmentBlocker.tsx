import { Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MobileAssessmentBlocker() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hurix-light p-4">
      <div className="card-premium max-w-lg text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <Monitor className="text-amber-600" size={32} />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal mb-3">
          Mobile devices are not supported for coding assessments.
        </h1>
        <p className="text-hurix-gray mb-8">
          Please use a laptop or desktop computer to take the assessment.
        </p>
        <Link to="/portal/dashboard" className="btn-primary inline-block px-6">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
