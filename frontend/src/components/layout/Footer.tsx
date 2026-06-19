interface FooterProps {
  variant?: 'default' | 'ambient';
}

export function Footer({ variant = 'default' }: FooterProps) {
  const isAmbient = variant === 'ambient';

  return (
    <footer
      className={`mt-auto border-t py-8 ${
        isAmbient
          ? 'border-white/30 bg-white/20 backdrop-blur-sm'
          : 'border-slate-100 bg-hurix-light'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-hurix-gray text-sm">
        <p>&copy; {new Date().getFullYear()} Hurix Digital. All rights reserved.</p>
        <p className="mt-1 text-xs">Vision to Innovation</p>
      </div>
    </footer>
  );
}
