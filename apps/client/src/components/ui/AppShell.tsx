import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ReconnectBanner } from './ReconnectBanner';

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-felt text-ivory">
      <ReconnectBanner />
      <header className={`safe-top mx-auto flex w-full items-center justify-between px-4 py-3 ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
        <Link to="/" className="tappable text-2xl font-black tracking-tight">
          GAFLEX
        </Link>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col px-4 pb-4 ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
        {children}
      </main>
      <footer
        className={`safe-bottom mx-auto w-full px-4 pb-4 pt-2 text-center text-xs font-semibold text-ivory/65 ${wide ? 'max-w-5xl' : 'max-w-md'}`}
      >
        © 2026 Fahim · Hak cipta dilindungi
      </footer>
    </div>
  );
}
