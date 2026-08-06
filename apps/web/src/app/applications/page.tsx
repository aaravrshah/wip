import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { ApplicationsExplorer } from '@/components/applications-explorer';
import { TrackerEmptyState } from '@/components/tracker-empty-state';
import { applicationRepository } from '@/data';
import { getServerEnvironment } from '@/env/server';

export const metadata: Metadata = {
  title: 'Applications',
};

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; trackerDeleted?: string }>;
}) {
  const [applications, timeZone] = await Promise.all([
    applicationRepository.listApplications(),
    applicationRepository.getTimeZone(),
  ]);
  const canManage = getServerEnvironment().dataSource === 'neon';
  const deleted = (await searchParams).deleted === '1';
  const trackerDeleted = (await searchParams).trackerDeleted === '1';

  if (applications.length === 0) {
    return (
      <div className="page-stack">
        {(deleted || trackerDeleted) && (
          <div className="form-alert form-alert-success" role="status">
            {trackerDeleted
              ? 'Your Wip tracker data was permanently deleted. Your sign-in account remains active.'
              : 'Application permanently deleted.'}
          </div>
        )}
        <TrackerEmptyState context="applications" />
      </div>
    );
  }

  return (
    <div className="page-stack">
      {(deleted || trackerDeleted) && (
        <div className="form-alert form-alert-success" role="status">
          {trackerDeleted
            ? 'Your Wip tracker data was permanently deleted. Your sign-in account remains active.'
            : 'Application permanently deleted.'}
        </div>
      )}
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your whole search</p>
          <h1>Applications</h1>
          <p>Every role, update, and next step—without the spreadsheet feeling.</p>
        </div>
        {canManage ? (
          <Link className="button button-primary" href="/applications/new">
            <Plus aria-hidden="true" size={17} /> Add application
          </Link>
        ) : (
          <div className="prototype-notice" role="note">
            Read-only fictional demo
          </div>
        )}
      </header>
      <ApplicationsExplorer applications={applications} canManage={canManage} timeZone={timeZone} />
    </div>
  );
}
