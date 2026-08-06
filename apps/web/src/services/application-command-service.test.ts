import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DemoReadOnlyCommandService,
  type ApplicationCommandService,
} from './application-command-service';
import {
  DemoReadOnlyMetadataCommandService,
  type MetadataCommandService,
} from './metadata-command-service';
import { DemoReadOnlyTrackerDataService, type TrackerDataService } from './tracker-data-service';

describe('demo mutation boundary', () => {
  test('rejects writes explicitly instead of pretending to persist them', async () => {
    const service: ApplicationCommandService = new DemoReadOnlyCommandService();

    await expect(
      service.createApplication(
        {
          company: 'Fictional Lumen Works',
          role: 'Associate Researcher',
          stage: 'saved',
          workplace: 'unspecified',
          sourceName: undefined,
          location: undefined,
          requisitionId: undefined,
          jobDescriptionText: undefined,
        },
        'demo-write-attempt-1234',
      ),
    ).rejects.toMatchObject({ code: 'demo_read_only', status: 403 });
  });

  test('also rejects metadata, export, and tracker-deletion commands', async () => {
    const metadata: MetadataCommandService = new DemoReadOnlyMetadataCommandService();
    const trackerData: TrackerDataService = new DemoReadOnlyTrackerDataService();

    await expect(
      metadata.createContact('fictional-application', {
        mode: 'create',
        name: 'Fictional Contact',
        relationship: 'other',
        organization: undefined,
        roleTitle: undefined,
        email: undefined,
        phone: undefined,
        profileUrl: undefined,
      }),
    ).rejects.toMatchObject({ code: 'demo_read_only', status: 403 });
    await expect(trackerData.exportJson()).rejects.toMatchObject({
      code: 'demo_read_only',
      status: 403,
    });
  });
});
