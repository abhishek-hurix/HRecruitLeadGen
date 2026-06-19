import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import teamAnimation from '../assets/team.json';

export function LandingPage() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_8%_18%,rgba(6,182,212,0.24),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(139,92,246,0.24),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(59,130,246,0.16),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#eaf9ff_46%,#f3edff_100%)]">
      <div className="pointer-events-none absolute -right-28 top-20 h-80 w-80 rounded-full bg-hurix-purple/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-16 h-80 w-80 rounded-full bg-hurix-cyan/25 blur-3xl" />
      <Header variant="ambient" />
      <main className="relative min-h-0 flex-1">
        <section className="relative h-full overflow-hidden">
          <div className="mx-auto flex h-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="max-w-3xl">
                <p className="mb-4 inline-flex rounded-full border border-hurix-blue/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-hurix-blue shadow-sm">
                Hurix Digital
              </p>
                <h1 className="text-4xl font-extrabold leading-tight text-hurix-charcoal sm:text-5xl lg:text-6xl">
                Talent Assessment Platform
              </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Join Hurix Digital's elite engineering team. Complete our premium technical assessment
                and showcase your problem-solving skills.
              </p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <Link to="/register" className="btn-primary px-8 py-4 text-base shadow-lg shadow-hurix-blue/20">
                  Apply Now
                </Link>
                </div>
              </div>

              <div className="relative flex min-h-[300px] items-center justify-center lg:min-h-[390px]">
                <div className="pointer-events-none absolute inset-6 rounded-full bg-white/20 blur-3xl" />
                <Lottie
                  animationData={teamAnimation}
                  loop
                  className="relative z-10 mx-auto h-[300px] w-full max-w-xl mix-blend-multiply sm:h-[340px] lg:h-[390px]"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="ambient" />
    </div>
  );
}
