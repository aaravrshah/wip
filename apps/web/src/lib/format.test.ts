import { describe, expect, test } from 'vitest';

import { formatDateTime } from './format';

describe('timezone-aware formatting', () => {
  test('renders the same UTC timestamp in the owner timezone', () => {
    const value = '2026-08-05T01:00:00.000Z';

    expect(formatDateTime(value, 'UTC')).toContain('Wed, Aug 5');
    expect(formatDateTime(value, 'America/New_York')).toContain('Tue, Aug 4');
  });

  test('falls back to UTC when a stored timezone is invalid', () => {
    expect(formatDateTime('2026-08-05T01:00:00.000Z', 'not-a-timezone')).toBe(
      formatDateTime('2026-08-05T01:00:00.000Z', 'UTC'),
    );
  });
});
