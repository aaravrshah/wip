import {
  applicationStages,
  stageLabels,
  type ApplicationStage,
  type TimelineEventKind,
} from './types';

export interface StageEventInput {
  id?: string;
  eventType: string;
  occurredAt: string;
  createdAt: string;
  confirmationState: 'pending' | 'confirmed' | 'rejected' | 'not_required';
  payload: Record<string, unknown>;
}

export interface StageProjection {
  stage: ApplicationStage;
  appliedAt?: string;
  lastConfirmedEventAt?: string;
}

export interface ManualStageEventPlan {
  eventType: string;
  eventKind: TimelineEventKind;
  title: string;
  occurredAt: string;
  payload: {
    targetStage: ApplicationStage;
    waitingOn: 'candidate' | 'employer' | 'none';
    appliedAt?: string;
  };
}

const eventStage: Partial<Record<string, ApplicationStage>> = {
  'application.created': 'saved',
  'application.preparation_started': 'preparing',
  'application.submitted': 'applied',
  'assessment.requested': 'assessment',
  'assessment.submitted': 'assessment',
  'assessment.completed': 'assessment',
  'screen.invited': 'interviewing',
  'screen.scheduled': 'interviewing',
  'screen.completed': 'interviewing',
  'interview.invited': 'interviewing',
  'interview.scheduled': 'interviewing',
  'interview.completed': 'interviewing',
  'offer.received': 'offer',
  'offer.accepted': 'accepted',
  'application.rejected': 'rejected',
  'offer.declined': 'withdrawn',
  'application.withdrawn': 'withdrawn',
};

function payloadStage(payload: Record<string, unknown>): ApplicationStage | undefined {
  const target = payload.targetStage;
  return typeof target === 'string' && applicationStages.includes(target as ApplicationStage)
    ? (target as ApplicationStage)
    : undefined;
}

export function waitingOnForStage(stage: ApplicationStage): 'candidate' | 'employer' | 'none' {
  if (['accepted', 'rejected', 'withdrawn'].includes(stage)) return 'none';
  if (stage === 'applied') return 'employer';
  return 'candidate';
}

export function planManualStageEvent({
  stage,
  effectiveAt,
  initial = false,
  appliedAt,
}: {
  stage: ApplicationStage;
  effectiveAt: string;
  initial?: boolean;
  appliedAt?: string;
}): ManualStageEventPlan {
  const payload = {
    targetStage: stage,
    waitingOn: waitingOnForStage(stage),
    ...(appliedAt ? { appliedAt } : {}),
  };

  if (initial) {
    return {
      eventType: 'application.created',
      eventKind: 'application',
      title: `Application added at ${stageLabels[stage]}`,
      occurredAt: effectiveAt,
      payload,
    };
  }

  const mapped = {
    accepted: ['offer.accepted', 'offer', 'Offer accepted'],
    applied: ['application.submitted', 'application', 'Application submitted'],
    assessment: ['assessment.requested', 'assessment', 'Assessment stage recorded'],
    interviewing: ['interview.scheduled', 'interview', 'Interviewing stage recorded'],
    offer: ['offer.received', 'offer', 'Offer received'],
    preparing: [
      'application.preparation_started',
      'application',
      'Application preparation started',
    ],
    rejected: ['application.rejected', 'status', 'Application rejected'],
    saved: ['application.status_corrected', 'status', 'Stage corrected to Saved'],
    withdrawn: ['application.withdrawn', 'status', 'Application withdrawn'],
  } as const satisfies Record<ApplicationStage, readonly [string, TimelineEventKind, string]>;
  const [eventType, eventKind, title] = mapped[stage];

  return { eventType, eventKind, title, occurredAt: effectiveAt, payload };
}

export function projectApplicationStage(
  events: StageEventInput[],
  fallback: ApplicationStage = 'saved',
): StageProjection {
  let stage = fallback;
  let appliedAt: string | undefined;
  let lastConfirmedEventAt: string | undefined;

  const confirmed = events
    .filter(
      ({ confirmationState }) =>
        confirmationState === 'confirmed' || confirmationState === 'not_required',
    )
    .sort((left, right) => {
      const occurrence = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      if (occurrence !== 0) return occurrence;
      const creation = Date.parse(left.createdAt) - Date.parse(right.createdAt);
      if (creation !== 0) return creation;
      return (left.id ?? '').localeCompare(right.id ?? '');
    });

  for (const event of confirmed) {
    stage = payloadStage(event.payload) ?? eventStage[event.eventType] ?? stage;
    const suppliedAppliedAt = event.payload.appliedAt;
    if (typeof suppliedAppliedAt === 'string') appliedAt = suppliedAppliedAt;
    if (event.eventType === 'application.submitted') appliedAt = event.occurredAt;
    lastConfirmedEventAt = event.occurredAt;
  }

  return {
    stage,
    ...(appliedAt ? { appliedAt } : {}),
    ...(lastConfirmedEventAt ? { lastConfirmedEventAt } : {}),
  };
}
