import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

const packageDirectory = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(packageDirectory, '../../apps/web/.env.local'), quiet: true });

const directDatabaseUrl = z
  .url()
  .startsWith('postgresql://')
  .refine((value) => !new URL(value).hostname.includes('-pooler'), {
    message: 'DIRECT_DATABASE_URL must use the direct Neon hostname, not the pooled hostname.',
  })
  .optional()
  .parse(process.env.DIRECT_DATABASE_URL);

if (process.argv.includes('migrate') && !directDatabaseUrl) {
  throw new Error('DIRECT_DATABASE_URL is required to apply migrations.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  ...(directDatabaseUrl ? { dbCredentials: { url: directDatabaseUrl } } : {}),
});
