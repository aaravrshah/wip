// @vitest-environment node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEMO_OWNER_ID, seedDemoData } from '@wip/database/seed';
import {
  applications,
  createAuthenticatedDatabase,
  createDatabase,
  jobDescriptionSnapshots,
  owners,
} from '@wip/database';
import { count, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createAuthenticatedNeonApplicationRepository,
  createOwnerScopedNeonApplicationRepositoryForTooling,
  provisionAuthenticatedOwner,
} from './neon-application-repository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testWithDatabase = testDatabaseUrl ? test : test.skip;
const authenticatedDatabaseUrl = process.env.TEST_NEON_AUTHENTICATED_DATABASE_URL;
const userAToken = process.env.TEST_CLERK_USER_A_JWT;
const userBToken = process.env.TEST_CLERK_USER_B_JWT;
const expiredToken = process.env.TEST_CLERK_EXPIRED_JWT;
const hasAuthenticatedTestConfiguration = Boolean(
  testDatabaseUrl && authenticatedDatabaseUrl && userAToken && userBToken,
);
const testWithAuthenticatedDatabase = hasAuthenticatedTestConfiguration ? test : test.skip;
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
    const repository = createOwnerScopedNeonApplicationRepositoryForTooling(
      database!,
      DEMO_OWNER_ID,
    );
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
    const repository = createOwnerScopedNeonApplicationRepositoryForTooling(
      database!,
      DEMO_OWNER_ID,
    );
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

    const otherRepository = createOwnerScopedNeonApplicationRepositoryForTooling(
      database!,
      otherOwnerId,
    );
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

describe('Neon Clerk RLS integration', () => {
  const database = testDatabaseUrl ? createDatabase(testDatabaseUrl) : undefined;
  let ownerAId: string;
  let ownerBId: string;

  beforeAll(async () => {
    if (!hasAuthenticatedTestConfiguration || !database) return;

    await migrate(database, { migrationsFolder: migrationDirectory });

    const userADatabase = createAuthenticatedDatabase(authenticatedDatabaseUrl!, userAToken!);
    const userBDatabase = createAuthenticatedDatabase(authenticatedDatabaseUrl!, userBToken!);
    ownerAId = await provisionAuthenticatedOwner(userADatabase);
    ownerBId = await provisionAuthenticatedOwner(userBDatabase);

    await database
      .insert(applications)
      .values([
        {
          id: '10000000-0000-4000-8000-000000000001',
          ownerId: ownerAId,
          publicId: 'fictional-rls-user-a',
          companyName: 'Fictional Aurora Studio',
          roleTitle: 'Junior Product Analyst',
          locationText: 'Remote',
          workplace: 'remote',
          currentStage: 'applied',
          projectedAppliedAt: new Date('2026-08-01T14:00:00Z'),
          lastConfirmedEventAt: new Date('2026-08-01T14:00:00Z'),
          waitingOn: 'employer',
          updatedAt: new Date('2026-08-01T14:00:00Z'),
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          ownerId: ownerBId,
          publicId: 'fictional-rls-user-b',
          companyName: 'Fictional Birch Works',
          roleTitle: 'Associate Researcher',
          locationText: 'Boston, MA',
          workplace: 'hybrid',
          currentStage: 'assessment',
          projectedAppliedAt: new Date('2026-08-02T14:00:00Z'),
          lastConfirmedEventAt: new Date('2026-08-02T14:00:00Z'),
          waitingOn: 'candidate',
          updatedAt: new Date('2026-08-02T14:00:00Z'),
        },
      ])
      .onConflictDoNothing();

    await database
      .insert(jobDescriptionSnapshots)
      .values([
        {
          id: '10000000-0000-4000-8000-000000000011',
          ownerId: ownerAId,
          applicationId: '10000000-0000-4000-8000-000000000001',
          capturedAt: new Date('2026-08-01T14:00:00Z'),
          captureSource: 'demo_seed',
          sourceUrl: 'https://example.invalid/fictional-user-a',
          descriptionHtml: '<p>Fictional RLS test role A.</p>',
          descriptionText: 'Fictional RLS test role A.',
          contentSha256: '1'.repeat(64),
          extractorVersion: 'rls-integration-test',
          provenance: 'Fictional RLS integration fixture',
        },
        {
          id: '20000000-0000-4000-8000-000000000012',
          ownerId: ownerBId,
          applicationId: '20000000-0000-4000-8000-000000000002',
          capturedAt: new Date('2026-08-02T14:00:00Z'),
          captureSource: 'demo_seed',
          sourceUrl: 'https://example.invalid/fictional-user-b',
          descriptionHtml: '<p>Fictional RLS test role B.</p>',
          descriptionText: 'Fictional RLS test role B.',
          contentSha256: '2'.repeat(64),
          extractorVersion: 'rls-integration-test',
          provenance: 'Fictional RLS integration fixture',
        },
      ])
      .onConflictDoNothing();
  }, 60_000);

  testWithAuthenticatedDatabase('provisions the same internal owner idempotently', async () => {
    const userADatabase = createAuthenticatedDatabase(authenticatedDatabaseUrl!, userAToken!);
    const repeatedOwnerId = await provisionAuthenticatedOwner(userADatabase);

    expect(repeatedOwnerId).toBe(ownerAId);
    expect(ownerAId).not.toBe(ownerBId);
  });

  testWithAuthenticatedDatabase(
    'isolates two users even when the other owner UUID is known',
    async () => {
      const userADatabase = createAuthenticatedDatabase(authenticatedDatabaseUrl!, userAToken!);
      const guessedRows = await userADatabase
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.ownerId, ownerBId));
      const userARepository = await createAuthenticatedNeonApplicationRepository({
        authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
        databaseToken: userAToken!,
      });
      const userBRepository = await createAuthenticatedNeonApplicationRepository({
        authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
        databaseToken: userBToken!,
      });

      expect(guessedRows).toEqual([]);
      await expect(userARepository.listApplications()).resolves.toMatchObject([
        { id: 'fictional-rls-user-a' },
      ]);
      await expect(userBRepository.listApplications()).resolves.toMatchObject([
        { id: 'fictional-rls-user-b' },
      ]);
    },
  );

  testWithAuthenticatedDatabase(
    'does not expose the fictional demo seed to authenticated users',
    async () => {
      const repository = await createAuthenticatedNeonApplicationRepository({
        authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
        databaseToken: userAToken!,
      });
      const visibleApplications = await repository.listApplications();

      expect(visibleApplications).toHaveLength(1);
      expect(visibleApplications.map((application) => application.id)).not.toContain(
        'cloverfield-digital',
      );
    },
  );

  testWithAuthenticatedDatabase(
    'fails closed for missing and malformed authentication',
    async () => {
      await expect(
        createAuthenticatedNeonApplicationRepository({
          authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
          databaseToken: '',
        }),
      ).rejects.toThrow(/verified database token/i);

      await expect(
        createAuthenticatedNeonApplicationRepository({
          authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
          databaseToken: 'not-a-valid-jwt',
        }),
      ).rejects.toThrow();
    },
  );

  testWithAuthenticatedDatabase(
    'fails closed when a valid token signature is changed',
    async () => {
      const tokenParts = userAToken!.split('.');
      const signature = tokenParts[2]!;
      tokenParts[2] = `${signature.startsWith('a') ? 'b' : 'a'}${signature.slice(1)}`;
      const invalidSignatureToken = tokenParts.join('.');

      await expect(
        createAuthenticatedNeonApplicationRepository({
          authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
          databaseToken: invalidSignatureToken,
        }),
      ).rejects.toThrow();
    },
  );

  (expiredToken ? test : test.skip)(
    'fails closed for an expired Clerk JWT',
    async () => {
      await expect(
        createAuthenticatedNeonApplicationRepository({
          authenticatedDatabaseUrl: authenticatedDatabaseUrl!,
          databaseToken: expiredToken!,
        }),
      ).rejects.toThrow();
    },
    30_000,
  );
});
