import { UserButton } from '@clerk/nextjs';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Navigation } from './navigation';

type ShellMode = 'authenticated' | 'demo' | 'public';

export function AppShell({ children, mode }: { children: ReactNode; mode: ShellMode }) {
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
          {mode !== 'public' ? <Navigation /> : <span />}
          {mode === 'demo' ? (
            <div className="demo-chip" aria-label="This prototype uses fictional data">
              <Sparkles aria-hidden="true" size={15} strokeWidth={2} />
              <span>Fictional demo</span>
            </div>
          ) : mode === 'authenticated' ? (
            <div className="account-menu">
              <UserButton showName />
            </div>
          ) : (
            <nav className="auth-actions" aria-label="Account">
              <Link className="text-link" href="/sign-in">
                Sign in
              </Link>
              <Link className="button button-primary button-compact" href="/sign-up">
                Create account
              </Link>
            </nav>
          )}
        </div>
      </header>
      <main id="main-content" className="page-shell">
        {children}
      </main>
      <footer className="site-footer">
        <p>
          Wip is a working name.{' '}
          {mode === 'demo'
            ? 'This explicit demo uses fictional, in-memory data.'
            : 'Your tracker is private to your signed-in account.'}
        </p>
      </footer>
    </div>
  );
}
