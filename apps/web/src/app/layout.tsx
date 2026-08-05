import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { hasAuthenticatedSession } from '@/auth/server';
import { AppShell } from '@/components/app-shell';
import { getServerEnvironment } from '@/env/server';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Wip — Your job search, in progress',
    template: '%s · Wip',
  },
  description:
    'A calm, evidence-backed place to keep job applications, next steps, and the details that matter.',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const environment = getServerEnvironment();
  const shellMode =
    environment.dataSource === 'demo'
      ? 'demo'
      : (await hasAuthenticatedSession())
        ? 'authenticated'
        : 'public';
  const document = (
    <html lang="en">
      <body>
        <AppShell mode={shellMode}>{children}</AppShell>
      </body>
    </html>
  );

  return environment.dataSource === 'neon' ? (
    <ClerkProvider dynamic>{document}</ClerkProvider>
  ) : (
    document
  );
}
