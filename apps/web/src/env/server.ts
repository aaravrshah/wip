import 'server-only';

import { z } from 'zod';

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WIP_DATA_SOURCE: z.enum(['demo', 'neon']).optional(),
  WIP_ALLOW_PRODUCTION_DEMO: z.enum(['true', 'false']).optional().default('false'),
  WIP_OWNER_ID: z.uuid().optional(),
  DATABASE_URL: z
    .url()
    .startsWith('postgresql://')
    .refine((value) => new URL(value).hostname.includes('-pooler'), {
      message: 'DATABASE_URL must use the pooled Neon hostname.',
    })
    .optional(),
});

export type ServerEnvironment =
  { dataSource: 'demo' } | { dataSource: 'neon'; databaseUrl: string; ownerId: string };

let cachedEnvironment: ServerEnvironment | undefined;

export function parseServerEnvironment(
  values: Record<string, string | undefined>,
): ServerEnvironment {
  const environment = baseEnvironmentSchema.parse(values);
  const dataSource = environment.WIP_DATA_SOURCE ?? 'demo';

  if (dataSource === 'demo') {
    if (environment.NODE_ENV === 'production' && environment.WIP_ALLOW_PRODUCTION_DEMO !== 'true') {
      throw new Error(
        'WIP_DATA_SOURCE=demo is disabled in production. Configure Neon or explicitly set WIP_ALLOW_PRODUCTION_DEMO=true for a non-deployed demo build.',
      );
    }

    return { dataSource: 'demo' };
  }

  if (!environment.DATABASE_URL || !environment.WIP_OWNER_ID) {
    throw new Error(
      'WIP_DATA_SOURCE=neon requires server-only DATABASE_URL and WIP_OWNER_ID values.',
    );
  }

  return {
    dataSource: 'neon',
    databaseUrl: environment.DATABASE_URL,
    ownerId: environment.WIP_OWNER_ID,
  };
}

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) return cachedEnvironment;

  cachedEnvironment = parseServerEnvironment(process.env);
  return cachedEnvironment;
}
