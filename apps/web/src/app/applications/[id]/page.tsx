import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ApplicationDetail } from '@/components/application-detail';
import { applicationRepository } from '@/data';
import { getServerEnvironment } from '@/env/server';

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: ApplicationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const application = await applicationRepository.getApplicationById(id);

  return {
    title: application ? `${application.role} at ${application.company}` : 'Application not found',
  };
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: ApplicationDetailPageProps) {
  const { id } = await params;
  const notice = await searchParams;
  const [application, availableContacts, availableDocuments, timeZone] = await Promise.all([
    applicationRepository.getApplicationById(id),
    applicationRepository.listContacts(),
    applicationRepository.listDocuments(),
    applicationRepository.getTimeZone(),
  ]);

  if (!application) notFound();

  return (
    <ApplicationDetail
      application={application}
      availableContacts={availableContacts}
      availableDocuments={availableDocuments}
      timeZone={timeZone}
      canManage={getServerEnvironment().dataSource === 'neon'}
      successMessage={
        notice.created === '1'
          ? 'Application added. Your timeline starts here.'
          : notice.updated === '1'
            ? 'Application facts updated.'
            : undefined
      }
    />
  );
}
