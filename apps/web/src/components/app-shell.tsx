import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Navigation } from './navigation';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="wordmark" href="/" aria-label="Wip home">
            Wip
          </Link>
          <Navigation />
          <div className="demo-chip" aria-label="This prototype uses fictional data">
            <Sparkles aria-hidden="true" size={15} strokeWidth={2} />
            <span>Fictional demo</span>
          </div>
        </div>
      </header>
      <main id="main-content" className="page-shell">
        {children}
      </main>
      <footer className="site-footer">
        <p>Wip is a working name. This Milestone 1A prototype uses fictional, in-memory data.</p>
      </footer>
    </div>
  );
}
