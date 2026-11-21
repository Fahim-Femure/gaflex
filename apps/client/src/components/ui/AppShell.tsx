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
      <main className={`safe-bottom mx-auto flex w-full flex-1 flex-col px-4 pb-8 ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
        {children}
      </main>
    </div>
  );
}
