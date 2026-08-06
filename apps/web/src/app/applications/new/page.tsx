import type { Metadata } from 'next';

import { requireAuthenticatedDatabaseIdentity } from '@/auth/server';
import { ApplicationForm } from '@/components/application-form';
import { DemoReadOnlyNotice } from '@/components/demo-read-only-notice';
import { getServerEnvironment } from '@/env/server';

export const metadata: Metadata = { title: 'Add application' };
export const dynamic = 'force-dynamic';

export default async function NewApplicationPage() {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return <DemoReadOnlyNotice />;
  await requireAuthenticatedDatabaseIdentity();
  return <ApplicationForm mode="create" />;
}
