import type { Metadata } from 'next';

import { requireAuthenticatedDatabaseIdentity } from '@/auth/server';
import { DataPrivacySettings } from '@/components/data-privacy-settings';
import { getServerEnvironment } from '@/env/server';

export const metadata: Metadata = { title: 'Data & privacy' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const canManage = getServerEnvironment().dataSource === 'neon';
  if (canManage) await requireAuthenticatedDatabaseIdentity();
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your data, your call</p>
          <h1>Data & privacy</h1>
          <p>Download a copy of your tracker or permanently clear it without deleting sign-in.</p>
        </div>
      </header>
      <DataPrivacySettings canManage={canManage} />
    </div>
  );
}
