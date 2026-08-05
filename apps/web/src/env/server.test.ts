import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseServerEnvironment } from './server';

describe('server environment selection', () => {
  test('uses demo data by default outside production', () => {
    expect(parseServerEnvironment({ NODE_ENV: 'development' })).toEqual({ dataSource: 'demo' });
  });

  test('does not silently use demo data in production', () => {
    expect(() => parseServerEnvironment({ NODE_ENV: 'production' })).toThrow(
      /disabled in production/i,
    );
  });

  test('requires a deliberate override for a production-mode demo build', () => {
    expect(
      parseServerEnvironment({
        NODE_ENV: 'production',
        WIP_DATA_SOURCE: 'demo',
        WIP_ALLOW_PRODUCTION_DEMO: 'true',
      }),
    ).toEqual({ dataSource: 'demo' });
  });

  test('requires server database configuration when Neon is selected', () => {
    expect(() =>
      parseServerEnvironment({ NODE_ENV: 'development', WIP_DATA_SOURCE: 'neon' }),
    ).toThrow(/requires server-only database_url and wip_owner_id/i);
  });

  test('returns validated Neon settings', () => {
    expect(
      parseServerEnvironment({
        NODE_ENV: 'development',
        WIP_DATA_SOURCE: 'neon',
        DATABASE_URL:
          'postgresql://placeholder:placeholder@example-pooler.invalid/placeholder?sslmode=require',
        WIP_OWNER_ID: '00000000-0000-5000-8000-000000000001',
      }),
    ).toEqual({
      dataSource: 'neon',
      databaseUrl:
        'postgresql://placeholder:placeholder@example-pooler.invalid/placeholder?sslmode=require',
      ownerId: '00000000-0000-5000-8000-000000000001',
    });
  });
});
