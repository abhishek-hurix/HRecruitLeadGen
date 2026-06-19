import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function EmailVerifiedSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4 bg-hurix-light">
        <div className="card-premium max-w-lg w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-green-600" size={36} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-hurix-charcoal mb-3">
            Email Verified Successfully
          </h1>
          <p className="text-hurix-gray mb-8 leading-relaxed">
            Your email has been verified. You may now start your assessment from your candidate
            dashboard.
          </p>
          <Link to="/portal/dashboard" className="btn-primary inline-flex px-8 py-3">
            Go To Dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
