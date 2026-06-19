import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function ExpiredPage() {
  return (
    <div className="min-h-screen flex flex-col bg-hurix-light">
      <Header showNav={false} />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card-premium max-w-lg text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="text-amber-600" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-hurix-charcoal mb-2">Assessment Link Expired</h1>
          <p className="text-hurix-gray mb-8">
            This assessment link is invalid, expired, or has already been used.
            Please contact Hurix if you need assistance.
          </p>
          <Link to="/" className="btn-primary inline-block px-8">
            Back To Home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
