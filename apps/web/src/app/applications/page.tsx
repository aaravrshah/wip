import type { Metadata } from 'next';

import { ApplicationsExplorer } from '@/components/applications-explorer';
import { TrackerEmptyState } from '@/components/tracker-empty-state';
import { applicationRepository } from '@/data';

export const metadata: Metadata = {
  title: 'Applications',
};

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const applications = await applicationRepository.listApplications();

  if (applications.length === 0) {
    return <TrackerEmptyState context="applications" />;
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your whole search</p>
          <h1>Applications</h1>
          <p>Every role, update, and next step—without the spreadsheet feeling.</p>
        </div>
        <div className="prototype-notice" role="note">
          Read-only prototype
        </div>
      </header>
      <ApplicationsExplorer applications={applications} />
    </div>
  );
}
