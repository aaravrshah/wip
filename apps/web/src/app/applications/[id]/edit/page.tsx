import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ApplicationForm } from '@/components/application-form';
import { DemoReadOnlyNotice } from '@/components/demo-read-only-notice';
import { applicationRepository } from '@/data';
import { getServerEnvironment } from '@/env/server';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: 'Edit application' };
export const dynamic = 'force-dynamic';

export default async function EditApplicationPage({ params }: PageProps) {
  const { id } = await params;
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return <DemoReadOnlyNotice />;
  const application = await applicationRepository.getApplicationById(id);
  if (!application) notFound();
  return <ApplicationForm mode="edit" application={application} />;
}
