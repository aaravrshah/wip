import { describe, expect, test } from 'vitest';

import { planManualStageEvent, projectApplicationStage } from './stage-projector';

describe('event-first stage projection', () => {
  test('projects confirmed history by effective time, not insertion time', () => {
    const projection = projectApplicationStage([
      {
        eventType: 'application.rejected',
        occurredAt: '2026-08-04T16:00:00.000Z',
        createdAt: '2026-08-04T16:01:00.000Z',
        confirmationState: 'confirmed',
        payload: { targetStage: 'rejected' },
      },
      {
        eventType: 'application.submitted',
        occurredAt: '2026-07-10T16:00:00.000Z',
        createdAt: '2026-08-05T16:00:00.000Z',
        confirmationState: 'confirmed',
        payload: { targetStage: 'applied' },
      },
    ]);

    expect(projection).toEqual({
      stage: 'rejected',
      appliedAt: '2026-07-10T16:00:00.000Z',
      lastConfirmedEventAt: '2026-08-04T16:00:00.000Z',
    });
  });

  test('ignores pending and rejected automated events', () => {
    expect(
      projectApplicationStage(
        [
          {
            eventType: 'offer.received',
            occurredAt: '2026-08-04T16:00:00.000Z',
            createdAt: '2026-08-04T16:01:00.000Z',
            confirmationState: 'pending',
            payload: { targetStage: 'offer' },
          },
        ],
        'applied',
      ).stage,
    ).toBe('applied');
  });

  test('uses the established taxonomy for realistic backward corrections', () => {
    expect(
      planManualStageEvent({
        stage: 'saved',
        effectiveAt: '2026-08-05T14:00:00.000Z',
      }),
    ).toMatchObject({
      eventType: 'application.status_corrected',
      eventKind: 'status',
      payload: { targetStage: 'saved', waitingOn: 'candidate' },
    });
  });
});
