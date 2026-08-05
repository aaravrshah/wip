// @vitest-environment node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEMO_OWNER_ID, seedDemoData } from '@wip/database/seed';
import { applications, createDatabase, jobDescriptionSnapshots, owners } from '@wip/database';
import { count, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createNeonApplicationRepositoryWithDatabase } from './neon-application-repository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testWithDatabase = testDatabaseUrl ? test : test.skip;
const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/database/drizzle',
);

describe('Neon persistence integration', () => {
  const database = testDatabaseUrl ? createDatabase(testDatabaseUrl) : undefined;
  let countsAfterFirstSeed: { applications: number; snapshots: number };
  let countsAfterSecondSeed: { applications: number; snapshots: number };

  async function demoCounts() {
    const [applicationCount] = await database!
      .select({ value: count() })
      .from(applications)
      .where(eq(applications.ownerId, DEMO_OWNER_ID));
    const [snapshotCount] = await database!
      .select({ value: count() })
      .from(jobDescriptionSnapshots)
      .where(eq(jobDescriptionSnapshots.ownerId, DEMO_OWNER_ID));

    return {
      applications: applicationCount?.value ?? 0,
      snapshots: snapshotCount?.value ?? 0,
    };
  }

  beforeAll(async () => {
    if (!database) return;

    await migrate(database, { migrationsFolder: migrationDirectory });
    await seedDemoData(database);
    countsAfterFirstSeed = await demoCounts();
    await seedDemoData(database);
    countsAfterSecondSeed = await demoCounts();
  }, 60_000);

  testWithDatabase('applies the checked-in migrations', async () => {
    const result = await database!.execute<{ tableName: string | null }>(
      sql`select to_regclass('public.application_events')::text as "tableName"`,
    );

    expect(result.rows[0]?.tableName).toBe('application_events');
  });

  testWithDatabase('seeds the twelve fictional applications idempotently', () => {
    expect(countsAfterFirstSeed).toEqual({ applications: 12, snapshots: 12 });
    expect(countsAfterSecondSeed).toEqual(countsAfterFirstSeed);
  });

  testWithDatabase('reads the complete application shape through the repository', async () => {
    const repository = createNeonApplicationRepositoryWithDatabase(database!, DEMO_OWNER_ID);
    const seededApplications = await repository.listApplications();
    const detail = await repository.getApplicationById('cloverfield-digital');

    expect(seededApplications).toHaveLength(12);
    expect(detail).toMatchObject({
      company: 'Cloverfield Digital',
      role: 'Product Design Intern',
      requisitionId: 'CFD-UX-204',
    });
    expect(detail?.timeline.length).toBeGreaterThan(0);
    expect(detail?.documents).toHaveLength(2);
  });

  testWithDatabase('returns timeline events in chronological occurrence order', async () => {
    const repository = createNeonApplicationRepositoryWithDatabase(database!, DEMO_OWNER_ID);
    const seededApplications = await repository.listApplications();

    for (const application of seededApplications) {
      const occurredTimes = application.timeline.map((event) => Date.parse(event.occurredAt));
      expect(occurredTimes).toEqual([...occurredTimes].sort((left, right) => left - right));
    }
  });

  testWithDatabase('scopes repository reads to one owner', async () => {
    const otherOwnerId = '00000000-0000-5000-8000-000000000099';
    await database!
      .insert(owners)
      .values({ id: otherOwnerId, timezone: 'UTC' })
      .onConflictDoNothing();

    const otherRepository = createNeonApplicationRepositoryWithDatabase(database!, otherOwnerId);
    const otherApplications = await otherRepository.listApplications();

    expect(otherApplications).toEqual([]);
  });

  testWithDatabase('rejects cross-owner child references', async () => {
    const otherOwnerId = '00000000-0000-5000-8000-000000000099';
    const [demoApplication] = await database!
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.ownerId, DEMO_OWNER_ID))
      .limit(1);

    expect(demoApplication).toBeDefined();
    await expect(
      database!.insert(jobDescriptionSnapshots).values({
        id: '00000000-0000-5000-8000-000000000098',
        ownerId: otherOwnerId,
        applicationId: demoApplication!.id,
        capturedAt: new Date('2026-08-04T12:00:00Z'),
        captureSource: 'demo_seed',
        descriptionHtml: '<p>Fictional cross-owner test.</p>',
        descriptionText: 'Fictional cross-owner test.',
        contentSha256: 'a'.repeat(64),
        extractorVersion: 'integration-test',
        provenance: 'Fictional integration test',
      }),
    ).rejects.toThrow();
  });

  testWithDatabase('rejects in-place snapshot updates', async () => {
    const [snapshot] = await database!
      .select({ id: jobDescriptionSnapshots.id })
      .from(jobDescriptionSnapshots)
      .where(eq(jobDescriptionSnapshots.ownerId, DEMO_OWNER_ID))
      .limit(1);

    expect(snapshot).toBeDefined();
    await expect(
      database!
        .update(jobDescriptionSnapshots)
        .set({ pageTitle: 'An update that must be rejected' })
        .where(eq(jobDescriptionSnapshots.id, snapshot!.id)),
    ).rejects.toThrow(/immutable records cannot be updated/i);
  });
});
