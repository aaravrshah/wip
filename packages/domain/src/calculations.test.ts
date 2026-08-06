import { describe, expect, it } from 'vitest';

import {
  getAwaitingResponses,
  getOverdueFollowUps,
  getStageCounts,
  getUpcomingItems,
  queryApplications,
} from './calculations';
import { applicationStages, type Application, type ApplicationStage } from './types';

const now = new Date('2026-08-04T09:00:00-04:00');

function application(
  id: string,
  stage: ApplicationStage,
  overrides: Partial<Application> = {},
): Application {
  return {
    id,
    company: `Company ${id}`,
    role: `Role ${id}`,
    location: 'Boston, MA',
    workplace: 'Hybrid',
    stage,
    dateApplied: '2026-07-20T09:00:00-04:00',
    updatedAt: '2026-08-01T09:00:00-04:00',
    waitingOn: 'candidate',
    sourceUrl: `https://jobs.example.com/${id}`,
    requisitionId: `REQ-${id}`,
    timeline: [],
    snapshot: {
      capturedAt: '2026-07-18T09:00:00-04:00',
      sourceUrl: `https://jobs.example.com/${id}`,
      provenance: 'Test fixture',
      extractorVersion: 'test-v1',
      contentHash: 'sha256:fixture',
      html: '<p>Fixture</p>',
      text: 'Fixture',
    },
    documents: [],
    contacts: [],
    notes: [],
    ...overrides,
  };
}

describe('application calculations', () => {
  it('counts every stage, including stages with no applications', () => {
    const counts = getStageCounts([
      application('one', 'applied'),
      application('two', 'applied'),
      application('three', 'assessment'),
    ]);

    expect(Object.keys(counts)).toEqual(applicationStages);
    expect(counts.applied).toBe(2);
    expect(counts.assessment).toBe(1);
    expect(counts.accepted).toBe(0);
  });

  it('returns only upcoming interviews and assessments in chronological order', () => {
    const applications = [
      application('interview', 'interviewing', {
        nextAction: {
          id: 'interview-action',
          kind: 'interview',
          title: 'Interview',
          dueAt: '2026-08-07T09:00:00-04:00',
        },
      }),
      application('assessment', 'assessment', {
        nextAction: {
          id: 'assessment-action',
          kind: 'assessment',
          title: 'Assessment',
          dueAt: '2026-08-05T09:00:00-04:00',
        },
      }),
      application('prepare', 'preparing', {
        nextAction: {
          id: 'prepare-action',
          kind: 'prepare',
          title: 'Prepare',
          dueAt: '2026-08-06T09:00:00-04:00',
        },
      }),
      application('later', 'interviewing', {
        nextAction: {
          id: 'later-action',
          kind: 'interview',
          title: 'Later interview',
          dueAt: '2026-09-01T09:00:00-04:00',
        },
      }),
    ];

    expect(getUpcomingItems(applications, now).map((item) => item.applicationId)).toEqual([
      'assessment',
      'interview',
    ]);
  });

  it('separates overdue follow-ups from applications awaiting an employer response', () => {
    const overdue = application('overdue', 'applied', {
      waitingOn: 'employer',
      nextAction: {
        id: 'follow-up',
        kind: 'follow-up',
        title: 'Follow up',
        dueAt: '2026-08-01T09:00:00-04:00',
      },
    });
    const accepted = application('accepted', 'accepted', { waitingOn: 'employer' });

    expect(getOverdueFollowUps([overdue, accepted], now)).toEqual([overdue]);
    expect(getAwaitingResponses([overdue, accepted])).toEqual([overdue]);
  });

  it('does not surface completed actions as upcoming or overdue', () => {
    const completed = application('completed', 'interviewing', {
      nextAction: {
        id: 'completed-action',
        kind: 'interview',
        title: 'Completed fictional interview',
        dueAt: '2026-08-03T09:00:00-04:00',
        state: 'completed',
        completedAt: '2026-08-03T10:00:00-04:00',
      },
    });

    expect(getUpcomingItems([completed], now)).toEqual([]);
    completed.nextAction!.kind = 'follow-up';
    expect(getOverdueFollowUps([completed], now)).toEqual([]);
  });

  it('searches, filters, and sorts without mutating the source list', () => {
    const source = [
      application('zeta', 'applied', {
        company: 'Zeta Studio',
        role: 'Designer',
        updatedAt: '2026-08-03T09:00:00-04:00',
      }),
      application('aster', 'assessment', {
        company: 'Aster Labs',
        role: 'Analyst',
        location: 'Austin, TX',
        updatedAt: '2026-08-04T09:00:00-04:00',
      }),
    ];

    expect(queryApplications(source, { search: 'Austin' }).map((item) => item.id)).toEqual([
      'aster',
    ]);
    expect(queryApplications(source, { stage: 'applied' }).map((item) => item.id)).toEqual([
      'zeta',
    ]);
    expect(queryApplications(source, { sort: 'company' }).map((item) => item.id)).toEqual([
      'aster',
      'zeta',
    ]);
    expect(source.map((item) => item.id)).toEqual(['zeta', 'aster']);
  });
});
