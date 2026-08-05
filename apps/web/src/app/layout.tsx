import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Wip — Your job search, in progress',
    template: '%s · Wip',
  },
  description:
    'A calm, evidence-backed place to keep job applications, next steps, and the details that matter.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
