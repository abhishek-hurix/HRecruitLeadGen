import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Mail } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function RegistrationSuccessPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'your email address';

  return (
    <div className="min-h-screen flex flex-col bg-hurix-light">
      <Header showNav={false} />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card-premium max-w-lg text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-500" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-hurix-charcoal mb-2">Registration Successful</h1>
          <p className="text-hurix-gray mb-6">
            Check your email to verify your address before starting the assessment.
          </p>

          <div className="bg-slate-50 rounded-xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Mail className="text-hurix-blue shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm text-hurix-gray mb-1">We have sent a verification link to:</p>
                <p className="font-semibold text-hurix-charcoal break-all">{email}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-hurix-gray mb-6">Please check:</p>
          <ul className="text-sm text-hurix-gray space-y-2 mb-8 text-left max-w-xs mx-auto">
            <li>✓ Inbox</li>
            <li>✓ Spam</li>
            <li>✓ Promotions</li>
          </ul>

          <Link to="/" className="btn-primary inline-block px-8">
            Back To Home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
