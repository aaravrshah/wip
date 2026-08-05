import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ApplicationDetail } from '@/components/application-detail';
import { applicationRepository } from '@/data';

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: ApplicationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const application = await applicationRepository.getApplicationById(id);

  return {
    title: application ? `${application.role} at ${application.company}` : 'Application not found',
  };
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const application = await applicationRepository.getApplicationById(id);

  if (!application) notFound();

  return <ApplicationDetail application={application} />;
}
