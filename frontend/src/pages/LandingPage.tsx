import { Link } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-hurix-cyan/5 via-transparent to-hurix-purple/5" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 relative">
            <div className="max-w-3xl">
              <p className="text-hurix-blue font-semibold text-sm uppercase tracking-widest mb-4">
                Hurix Digital
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-hurix-charcoal leading-tight">
                Talent Assessment Platform
              </h1>
              <p className="mt-6 text-lg text-hurix-gray leading-relaxed max-w-2xl">
                Join Hurix Digital's elite engineering team. Complete our premium technical assessment
                and showcase your problem-solving skills.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/register" className="btn-primary text-base px-8 py-4">
                  Apply Now
                </Link>
                <Link to="/login" className="btn-secondary text-base px-8 py-4">
                  Candidate Login
                </Link>
                <Link to="/admin/login" className="btn-secondary text-base px-6 py-4 hidden sm:inline-flex">
                  Admin Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
