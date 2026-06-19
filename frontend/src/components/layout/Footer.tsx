export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-hurix-light py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-hurix-gray text-sm">
        <p>&copy; {new Date().getFullYear()} Hurix Digital. All rights reserved.</p>
        <p className="mt-1 text-xs">Vision to Innovation</p>
      </div>
    </footer>
  );
}
