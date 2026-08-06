import {
  applicationStages,
  type Application,
  type ApplicationQuery,
  type ApplicationStage,
  type UpcomingItem,
} from './types';

const DAY_IN_MS = 86_400_000;

function timestamp(value: string): number {
  return new Date(value).getTime();
}

function descendingDate(left?: string, right?: string): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return timestamp(right) - timestamp(left);
}

function isOpenAction(application: Application): boolean {
  return Boolean(
    application.nextAction &&
    (application.nextAction.state === undefined || application.nextAction.state === 'open'),
  );
}

export function getStageCounts(applications: Application[]): Record<ApplicationStage, number> {
  const counts = Object.fromEntries(applicationStages.map((stage) => [stage, 0])) as Record<
    ApplicationStage,
    number
  >;

  for (const application of applications) {
    counts[application.stage] += 1;
  }

  return counts;
}

export function getUpcomingItems(
  applications: Application[],
  now: Date,
  horizonDays = 14,
): UpcomingItem[] {
  const start = now.getTime();
  const end = start + horizonDays * DAY_IN_MS;

  return applications
    .filter((application) => {
      const action = application.nextAction;
      if (
        !action ||
        !isOpenAction(application) ||
        (action.kind !== 'assessment' && action.kind !== 'interview')
      )
        return false;
      const dueAt = timestamp(action.dueAt);
      return dueAt >= start && dueAt <= end;
    })
    .map((application) => ({
      applicationId: application.id,
      company: application.company,
      role: application.role,
      action: application.nextAction!,
    }))
    .sort((left, right) => timestamp(left.action.dueAt) - timestamp(right.action.dueAt));
}

export function getOverdueFollowUps(applications: Application[], now: Date): Application[] {
  return applications
    .filter(
      (application) =>
        isOpenAction(application) &&
        application.nextAction?.kind === 'follow-up' &&
        timestamp(application.nextAction.dueAt) < now.getTime(),
    )
    .sort((left, right) => timestamp(left.nextAction!.dueAt) - timestamp(right.nextAction!.dueAt));
}

export function getAwaitingResponses(applications: Application[]): Application[] {
  return applications
    .filter(
      (application) =>
        application.waitingOn === 'employer' &&
        !['accepted', 'rejected', 'withdrawn'].includes(application.stage),
    )
    .sort((left, right) => timestamp(left.updatedAt) - timestamp(right.updatedAt));
}

export function getRecentlyChanged(applications: Application[], limit = 5): Application[] {
  return [...applications]
    .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))
    .slice(0, limit);
}

export function queryApplications(
  applications: Application[],
  { search = '', stage = 'all', sort = 'updated' }: ApplicationQuery,
): Application[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return applications
    .filter((application) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [application.company, application.role, application.location].some((value) =>
          value.toLocaleLowerCase().includes(normalizedSearch),
        );
      const matchesStage = stage === 'all' || application.stage === stage;
      return matchesSearch && matchesStage;
    })
    .sort((left, right) => {
      switch (sort) {
        case 'company':
          return left.company.localeCompare(right.company);
        case 'date-applied':
          return descendingDate(left.dateApplied, right.dateApplied);
        case 'stage':
          return applicationStages.indexOf(left.stage) - applicationStages.indexOf(right.stage);
        case 'updated':
          return timestamp(right.updatedAt) - timestamp(left.updatedAt);
      }
    });
}

export function daysSince(value: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - timestamp(value)) / DAY_IN_MS));
}
