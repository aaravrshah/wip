import {
  getAwaitingResponses,
  getOverdueFollowUps,
  getRecentlyChanged,
  getStageCounts,
  getUpcomingItems,
} from '@wip/domain';

import { TodayDashboard } from '@/components/today-dashboard';
import { applicationRepository } from '@/data';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const applications = await applicationRepository.listApplications();
  const referenceDate = applicationRepository.getReferenceDate();

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
