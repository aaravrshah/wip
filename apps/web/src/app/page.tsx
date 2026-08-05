import {
  getAwaitingResponses,
  getOverdueFollowUps,
  getRecentlyChanged,
  getStageCounts,
  getUpcomingItems,
} from '@wip/domain';

import { hasAuthenticatedSession } from '@/auth/server';
import { SignedOutLanding } from '@/components/signed-out-landing';
import { TrackerEmptyState } from '@/components/tracker-empty-state';
import { TodayDashboard } from '@/components/today-dashboard';
import { applicationRepository } from '@/data';
import { getServerEnvironment } from '@/env/server';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'neon' && !(await hasAuthenticatedSession())) {
    return <SignedOutLanding />;
  }

  const applications = await applicationRepository.listApplications();
  const referenceDate = applicationRepository.getReferenceDate();

  if (applications.length === 0) {
    return <TrackerEmptyState context="today" />;
  }

  return (
    <TodayDashboard
      applications={applications}
      referenceDate={referenceDate}
      stageCounts={getStageCounts(applications)}
      upcoming={getUpcomingItems(applications, referenceDate)}
      overdue={getOverdueFollowUps(applications, referenceDate)}
      awaiting={getAwaitingResponses(applications)}
      recent={getRecentlyChanged(applications, 4)}
    />
  );
}
