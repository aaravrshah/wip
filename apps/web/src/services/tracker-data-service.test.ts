import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { WipDatabase } from '@wip/database';

import { NeonTrackerDataService, safeCsvCell } from './tracker-data-service';

describe('tracker export serialization', () => {
  test('quotes CSV values and neutralizes spreadsheet formulas', () => {
    expect(safeCsvCell('Fictional "Studio"')).toBe('"Fictional ""Studio"""');
    expect(safeCsvCell('=HYPERLINK("https://example.invalid")')).toBe(
      '"\'=HYPERLINK(""https://example.invalid"")"',
    );
    expect(safeCsvCell(new Date('2026-08-05T12:00:00.000Z'))).toBe('"2026-08-05T12:00:00.000Z"');
  });

  test('enforces the deletion phrase at the command-service boundary', async () => {
    const service = new NeonTrackerDataService({} as WipDatabase, crypto.randomUUID());

    await expect(
      service.deleteTrackerData({ confirmation: 'wrong phrase' } as unknown as {
        confirmation: 'DELETE MY WIP DATA';
      }),
    ).rejects.toMatchObject({ code: 'validation_error', status: 400 });
  });
});
