import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

import { createDatabase } from './client';
import { DEMO_OWNER_ID, seedDemoData } from './seed';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(sourceDirectory, '../../../apps/web/.env.local'), quiet: true });

const seedEnvironmentSchema = z.object({
  DATABASE_URL: z
    .url()
    .startsWith('postgresql://')
    .refine((value) => new URL(value).hostname.includes('-pooler'), {
      message: 'DATABASE_URL must use the pooled Neon hostname.',
    }),
  WIP_OWNER_ID: z.uuid().default(DEMO_OWNER_ID),
});

const environment = seedEnvironmentSchema.parse(process.env);
const database = createDatabase(environment.DATABASE_URL);

await seedDemoData(database, environment.WIP_OWNER_ID);

console.info(`Seeded ${environment.WIP_OWNER_ID} with fictional Wip demo data.`);
