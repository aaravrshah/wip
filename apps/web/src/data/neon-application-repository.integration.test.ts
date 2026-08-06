// @vitest-environment node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { DEMO_OWNER_ID, seedDemoData } from '@wip/database/seed';
import {
  applications,
  applicationEvents,
  createDatabase,
  documentVersions,
  jobDescriptionSnapshots,
  nextActions,
  notes,
  owners,
  withTenantDatabase,
  type WipDatabase,
} from '@wip/database';
import type { Application } from '@wip/domain';
import { extensionCaptureCommandSchema } from '@wip/schemas';
import { and, count, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createAuthenticatedNeonApplicationRepository,
  createOwnerScopedNeonApplicationRepositoryForTooling,
  provisionAuthenticatedOwner,
} from './neon-application-repository';
import { NeonApplicationCommandService } from '@/services/application-command-service';
import { NeonExtensionCaptureService } from '@/services/extension-capture-service';
import { NeonMetadataCommandService } from '@/services/metadata-command-service';
import { NeonTrackerDataService } from '@/services/tracker-data-service';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testWithDatabase = testDatabaseUrl ? test : test.skip;
const runtimeDatabaseUrl = process.env.TEST_NEON_RUNTIME_DATABASE_URL;
const userASubject = process.env.TEST_CLERK_USER_A_ID;
const userBSubject = process.env.TEST_CLERK_USER_B_ID;
const hasAuthenticatedTestConfiguration = Boolean(
  testDatabaseUrl && runtimeDatabaseUrl && userASubject && userBSubject,
);
const testWithAuthenticatedDatabase = hasAuthenticatedTestConfiguration ? test : test.skip;
const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/database/drizzle',
);

async function withTestTenant<T>(
  clerkSubject: string,
  operation: (database: WipDatabase, ownerId: string) => Promise<T>,
): Promise<T> {
  return withTenantDatabase(runtimeDatabaseUrl!, clerkSubject, async (database) => {
    const ownerId = await provisionAuthenticatedOwner(database);
    return operation(database, ownerId);
  });
}

function tenantService<T extends object>(
  clerkSubject: string,
  createService: (database: WipDatabase, ownerId: string) => T,
): T {
  return new Proxy({} as T, {
    get:
      (_target, property) =>
      (...args: unknown[]) =>
        withTestTenant(clerkSubject, async (database, ownerId) => {
          const service = createService(database, ownerId);
          const method = Reflect.get(service, property);
          if (typeof method !== 'function')
            throw new Error(`Unknown service method: ${String(property)}`);
          return Reflect.apply(method, service, args);
        }),
  });
}

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

  testWithDatabase(
    'creates one complete extension capture and handles duplicate and idempotent retries',
    async () => {
      const captureRunId = randomUUID();
      const captureOwnerId = randomUUID();
      await database!.insert(owners).values({ id: captureOwnerId, timezone: 'UTC' });
      const service = new NeonExtensionCaptureService(database!, captureOwnerId);
      const command = extensionCaptureCommandSchema.parse({
        company: 'Fictional Integration Capture Lab',
        role: 'Junior Capture Analyst',
        stage: 'saved',
        sourceUrl: `https://jobs.example.invalid/capture/${captureRunId}?utm_source=test`,
        canonicalUrl: `https://jobs.example.invalid/capture/${captureRunId}`,
        pageTitle: 'Junior Capture Analyst — Fictional Integration Capture Lab',
        location: 'Remote',
        workplace: 'remote',
        employmentType: 'Full-time',
        requisitionId: `FIC-${captureRunId}`,
        descriptionHtml:
          '<section onclick="ignored()"><h2>About</h2><script>ignored()</script><p>Validate a fictional extension capture transaction.</p></section>',
        descriptionText:
          'About\n\nValidate a fictional extension capture transaction without real applicant data.',
        extraction: {
          extractorVersion: 'wip-extractor/1.0.0',
          selectedSource: 'json_ld',
          fieldEvidence: {
            description: { source: 'json_ld', confidence: 'high' },
          },
          warnings: [],
        },
      });
      const key = `extension-integration-tooling:${captureRunId}`;

      const first = await service.capture(command, key);
      expect(first).toMatchObject({ status: 'created', idempotentReplay: false });
      const applicationRow = await database!.query.applications.findFirst({
        where: and(
          eq(applications.ownerId, captureOwnerId),
          eq(applications.publicId, first.application.id),
        ),
      });
      expect(applicationRow).toBeDefined();
      const [events, snapshots] = await Promise.all([
        database!
          .select()
          .from(applicationEvents)
          .where(eq(applicationEvents.applicationId, applicationRow!.id)),
        database!
          .select()
          .from(jobDescriptionSnapshots)
          .where(eq(jobDescriptionSnapshots.applicationId, applicationRow!.id)),
      ]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ source: 'extension', confirmationState: 'confirmed' });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({ captureSource: 'extension' });
      expect(snapshots[0]!.descriptionHtml).not.toMatch(/script|onclick/i);
      expect(snapshots[0]!.contentSha256).toMatch(/^[0-9a-f]{64}$/);

      await expect(service.capture(command, key)).resolves.toMatchObject({
        status: 'created',
        idempotentReplay: true,
        application: { id: first.application.id },
      });
      await expect(
        service.capture(command, `extension-integration-duplicate:${captureRunId}`),
      ).resolves.toMatchObject({
        status: 'duplicate',
        application: { id: first.application.id },
        matchedOn: expect.arrayContaining(['source_url', 'requisition_id']),
      });

      const [eventCount, snapshotCount] = await Promise.all([
        database!
          .select({ value: count() })
          .from(applicationEvents)
          .where(eq(applicationEvents.applicationId, applicationRow!.id)),
        database!
          .select({ value: count() })
          .from(jobDescriptionSnapshots)
          .where(eq(jobDescriptionSnapshots.applicationId, applicationRow!.id)),
      ]);
      expect(eventCount[0]?.value).toBe(1);
      expect(snapshotCount[0]?.value).toBe(1);
      await database!.delete(owners).where(eq(owners.id, captureOwnerId));
    },
    30_000,
  );

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
    });
    expect(detail?.role).toEqual(expect.any(String));
    expect(detail?.requisitionId).toEqual(expect.any(String));
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
      .select({ id: jobDescriptionSnapshots.id, pageTitle: jobDescriptionSnapshots.pageTitle })
      .from(jobDescriptionSnapshots)
      .where(eq(jobDescriptionSnapshots.ownerId, DEMO_OWNER_ID))
      .limit(1);

    expect(snapshot).toBeDefined();
    await expect(
      database!
        .update(jobDescriptionSnapshots)
        .set({ pageTitle: 'An update that must be rejected' })
        .where(eq(jobDescriptionSnapshots.id, snapshot!.id)),
    ).rejects.toThrow();
    const unchanged = await database!.query.jobDescriptionSnapshots.findFirst({
      where: eq(jobDescriptionSnapshots.id, snapshot!.id),
    });
    expect(unchanged?.pageTitle).toBe(snapshot!.pageTitle);
  });
});

describe.sequential('Neon Clerk RLS integration', () => {
  const database = testDatabaseUrl ? createDatabase(testDatabaseUrl) : undefined;
  const mutationRunId = randomUUID();
  const createIdempotencyKey = `integration-create:${mutationRunId}`;
  let managedApplicationId: string;
  let ownerAId: string;
  let ownerBId: string;
  let serviceA: NeonApplicationCommandService;
  let serviceB: NeonApplicationCommandService;
  let metadataServiceA: NeonMetadataCommandService;
  let metadataServiceB: NeonMetadataCommandService;
  let trackerDataServiceA: NeonTrackerDataService;

  beforeAll(async () => {
    if (!hasAuthenticatedTestConfiguration || !database) return;

    await migrate(database, { migrationsFolder: migrationDirectory });

    ownerAId = await withTestTenant(userASubject!, async (_database, ownerId) => ownerId);
    ownerBId = await withTestTenant(userBSubject!, async (_database, ownerId) => ownerId);
    serviceA = tenantService(
      userASubject!,
      (tenantDatabase, ownerId) => new NeonApplicationCommandService(tenantDatabase, ownerId),
    );
    serviceB = tenantService(
      userBSubject!,
      (tenantDatabase, ownerId) => new NeonApplicationCommandService(tenantDatabase, ownerId),
    );
    metadataServiceA = tenantService(
      userASubject!,
      (tenantDatabase, ownerId) => new NeonMetadataCommandService(tenantDatabase, ownerId),
    );
    metadataServiceB = tenantService(
      userBSubject!,
      (tenantDatabase, ownerId) => new NeonMetadataCommandService(tenantDatabase, ownerId),
    );
    trackerDataServiceA = tenantService(
      userASubject!,
      (tenantDatabase, ownerId) => new NeonTrackerDataService(tenantDatabase, ownerId),
    );

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
    const repeatedOwnerId = await withTestTenant(
      userASubject!,
      async (_database, ownerId) => ownerId,
    );

    expect(repeatedOwnerId).toBe(ownerAId);
    expect(ownerAId).not.toBe(ownerBId);
  });

  testWithAuthenticatedDatabase(
    'does not leak optional child records across conflicting concurrent creates',
    async () => {
      const key = `integration-concurrent-create:${mutationRunId}`;
      const base = {
        company: 'Fictional Concurrency Studio',
        stage: 'saved' as const,
        workplace: 'unspecified' as const,
        sourceName: undefined,
        location: undefined,
        requisitionId: undefined,
        jobDescriptionText: undefined,
      };
      const [bareResult, richResult] = await Promise.allSettled([
        serviceA.createApplication({ ...base, role: 'Bare fictional command' }, key),
        serviceA.createApplication(
          {
            ...base,
            role: 'Rich fictional command',
            jobDescriptionText: 'Fictional optional description.',
            nextAction: {
              kind: 'follow_up' as const,
              title: 'Fictional optional action',
              details: undefined,
              dueAt: '2026-08-20T15:00:00.000Z',
            },
          },
          key,
        ),
      ]);
      const fulfilled = [bareResult, richResult].filter(
        (result): result is PromiseFulfilledResult<Application> => result.status === 'fulfilled',
      );
      const rejected = [bareResult, richResult].filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toMatchObject({ code: 'idempotency_conflict', status: 409 });
      const winner = fulfilled[0]!.value;
      if (winner.role === 'Bare fictional command') {
        expect(winner.snapshot).toBeUndefined();
        expect(winner.nextActions).toEqual([]);
      } else {
        expect(winner.snapshot).toBeDefined();
        expect(winner.nextActions).toHaveLength(1);
      }
      await serviceA.deleteApplication(winner.id, { confirmation: winner.company });
    },
  );

  testWithAuthenticatedDatabase(
    'creates an application, initial event, snapshot, and action atomically and idempotently',
    async () => {
      const command = {
        company: 'Fictional Northstar Collective',
        role: 'Early Career Product Associate',
        stage: 'applied' as const,
        sourceUrl: 'https://example.invalid/fictional-northstar-role',
        sourceName: 'Fictional employer site',
        location: 'Remote',
        workplace: 'remote' as const,
        requisitionId: 'FICTIONAL-INT-1B3',
        appliedAt: '2026-08-01T16:00:00.000Z',
        jobDescriptionText: 'Build thoughtful fictional workflows.\n\nWork with a small team.',
        nextAction: {
          kind: 'follow_up' as const,
          title: 'Follow up on fictional application',
          details: undefined,
          dueAt: '2026-08-12T16:00:00.000Z',
        },
      };

      const first = await serviceA.createApplication(command, createIdempotencyKey);
      const retried = await serviceA.createApplication(command, createIdempotencyKey);
      managedApplicationId = first.id;

      expect(retried.id).toBe(first.id);
      expect(first).toMatchObject({
        company: command.company,
        dateApplied: command.appliedAt,
        stage: 'applied',
      });
      expect(first.timeline).toHaveLength(1);
      expect(first.timeline[0]).toMatchObject({
        eventType: 'application.created',
        confirmationState: 'confirmed',
      });
      expect(first.snapshot).toMatchObject({
        extractorVersion: 'manual-paste-v1',
        provenance: 'User-pasted job description',
      });
      expect(first.snapshot?.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(first.nextActions).toHaveLength(1);

      const persisted = await database!.query.applications.findFirst({
        where: and(
          eq(applications.ownerId, ownerAId),
          eq(applications.publicId, managedApplicationId),
        ),
      });
      expect(persisted).toBeDefined();
      const [eventCount, snapshotCount, actionCount] = await Promise.all([
        database!
          .select({ value: count() })
          .from(applicationEvents)
          .where(eq(applicationEvents.applicationId, persisted!.id)),
        database!
          .select({ value: count() })
          .from(jobDescriptionSnapshots)
          .where(eq(jobDescriptionSnapshots.applicationId, persisted!.id)),
        database!
          .select({ value: count() })
          .from(nextActions)
          .where(eq(nextActions.applicationId, persisted!.id)),
      ]);
      expect(eventCount[0]?.value).toBe(1);
      expect(snapshotCount[0]?.value).toBe(1);
      expect(actionCount[0]?.value).toBe(1);
      await expect(
        serviceA.createApplication(
          { ...command, role: 'Different fictional role' },
          createIdempotencyKey,
        ),
      ).rejects.toMatchObject({ code: 'idempotency_conflict', status: 409 });
    },
  );

  testWithAuthenticatedDatabase(
    'audits meaningful fact edits and rejects stale updates',
    async () => {
      const repository = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userASubject!,
      });
      const before = await repository.getApplicationById(managedApplicationId);
      expect(before).toBeDefined();
      const command = {
        expectedVersion: before!.version!,
        company: before!.company,
        role: before!.role,
        sourceUrl: before!.sourceUrl,
        sourceName: 'Fictional referral',
        location: before!.location,
        workplace: 'remote' as const,
        requisitionId: before!.requisitionId,
      };

      const edited = await serviceA.updateApplication(managedApplicationId, command);
      expect(edited.sourceName).toBe('Fictional referral');
      expect(edited.version).toBe(command.expectedVersion + 1);
      expect(
        edited.timeline.filter(({ eventType }) => eventType === 'application.facts_updated'),
      ).toHaveLength(1);

      const unchanged = await serviceA.updateApplication(managedApplicationId, {
        ...command,
        expectedVersion: edited.version!,
        sourceName: edited.sourceName,
      });
      expect(unchanged.version).toBe(edited.version);
      expect(
        unchanged.timeline.filter(({ eventType }) => eventType === 'application.facts_updated'),
      ).toHaveLength(1);

      await expect(
        serviceA.updateApplication(managedApplicationId, {
          ...command,
          sourceName: 'A stale fictional overwrite',
        }),
      ).rejects.toMatchObject({ code: 'conflict', status: 409 });
    },
  );

  testWithAuthenticatedDatabase(
    'appends stage history, preserves effective time, projects the latest event, and retries safely',
    async () => {
      const interviewKey = `integration-stage-interview:${mutationRunId}`;
      const backdatedKey = `integration-stage-backdated:${mutationRunId}`;
      const interviewing = await serviceA.recordStageChange(
        managedApplicationId,
        { stage: 'interviewing', effectiveAt: '2026-08-10T14:00:00.000Z' },
        interviewKey,
      );
      const versionAfterInterview = interviewing.version;
      const backdated = await serviceA.recordStageChange(
        managedApplicationId,
        { stage: 'assessment', effectiveAt: '2026-08-08T14:00:00.000Z' },
        backdatedKey,
      );
      const retried = await serviceA.recordStageChange(
        managedApplicationId,
        { stage: 'assessment', effectiveAt: '2026-08-08T14:00:00.000Z' },
        backdatedKey,
      );

      expect(interviewing.stage).toBe('interviewing');
      expect(backdated.stage).toBe('interviewing');
      expect(backdated.version).toBe(versionAfterInterview! + 1);
      expect(retried.version).toBe(backdated.version);
      await expect(
        serviceA.recordStageChange(
          managedApplicationId,
          { stage: 'offer', effectiveAt: '2026-08-08T14:00:00.000Z' },
          backdatedKey,
        ),
      ).rejects.toMatchObject({ code: 'idempotency_conflict', status: 409 });
      expect(
        backdated.timeline.filter(({ occurredAt }) =>
          ['2026-08-08T14:00:00.000Z', '2026-08-10T14:00:00.000Z'].includes(occurredAt),
        ),
      ).toHaveLength(2);
      const backdatedEvent = backdated.timeline.find(
        ({ occurredAt }) => occurredAt === '2026-08-08T14:00:00.000Z',
      );
      expect(backdatedEvent!.createdAt).not.toBe(backdatedEvent!.occurredAt);

      await expect(
        withTestTenant(userASubject!, (tenantDatabase) =>
          tenantDatabase
            .update(applicationEvents)
            .set({ title: 'An impermissible history rewrite' })
            .where(eq(applicationEvents.id, backdatedEvent!.id)),
        ),
      ).rejects.toThrow();
    },
  );

  testWithAuthenticatedDatabase('supports the note and next-action lifecycle', async () => {
    let updated = await serviceA.createNote(managedApplicationId, {
      body: 'Fictional private preparation note.',
    });
    const note = updated.notes.at(-1)!;
    updated = await serviceA.updateNote(managedApplicationId, note.id, {
      expectedVersion: note.version!,
      body: 'Updated fictional preparation note.',
    });
    expect(updated.notes.find(({ id }) => id === note.id)).toMatchObject({
      body: 'Updated fictional preparation note.',
      version: note.version! + 1,
    });
    updated = await serviceA.deleteNote(managedApplicationId, note.id);
    expect(updated.notes.map(({ id }) => id)).not.toContain(note.id);

    updated = await serviceA.createNextAction(managedApplicationId, {
      kind: 'interview',
      title: 'Prepare a fictional case study',
      details: undefined,
      dueAt: '2026-08-11T15:00:00.000Z',
    });
    const action = updated.nextActions!.find(
      ({ title }) => title === 'Prepare a fictional case study',
    )!;
    updated = await serviceA.updateNextAction(managedApplicationId, action.id, {
      expectedVersion: action.version!,
      kind: 'interview',
      title: action.title,
      details: undefined,
      dueAt: '2026-08-13T15:00:00.000Z',
      state: 'open',
    });
    const rescheduled = updated.nextActions!.find(({ id }) => id === action.id)!;
    expect(rescheduled.dueAt).toBe('2026-08-13T15:00:00.000Z');
    updated = await serviceA.updateNextAction(managedApplicationId, action.id, {
      expectedVersion: rescheduled.version!,
      kind: 'interview',
      title: action.title,
      details: undefined,
      dueAt: rescheduled.dueAt,
      state: 'completed',
    });
    const completed = updated.nextActions!.find(({ id }) => id === action.id)!;
    expect(completed).toMatchObject({ state: 'completed' });
    expect(completed.completedAt).toBeDefined();
    expect(updated.nextAction?.id).not.toBe(action.id);
    updated = await serviceA.deleteNextAction(managedApplicationId, action.id);
    expect(updated.nextActions!.map(({ id }) => id)).not.toContain(action.id);
  });

  testWithAuthenticatedDatabase(
    'creates, updates, links, and owner-isolates application contacts',
    async () => {
      let updated = await metadataServiceA.createContact('fictional-rls-user-a', {
        mode: 'create',
        name: 'Fictional Avery Recruiter',
        relationship: 'recruiter',
        organization: 'Fictional Aurora Studio',
        roleTitle: 'Early talent partner',
        email: 'avery@example.invalid',
        phone: undefined,
        profileUrl: undefined,
      });
      const contact = updated.contacts.find(({ name }) => name === 'Fictional Avery Recruiter')!;
      expect(contact).toMatchObject({ relationship: 'recruiter', version: 1 });

      updated = await metadataServiceA.updateContact(
        'fictional-rls-user-a',
        contact.associationId!,
        {
          expectedVersion: contact.version!,
          name: 'Fictional Avery Recruiter',
          relationship: 'hiring_manager',
          organization: 'Fictional Aurora Studio',
          roleTitle: 'Hiring manager',
          email: 'avery@example.invalid',
          phone: undefined,
          profileUrl: undefined,
        },
      );
      expect(updated.contacts.find(({ id }) => id === contact.id)).toMatchObject({
        relationship: 'hiring_manager',
        roleTitle: 'Hiring manager',
        version: 2,
      });

      const userBApplication = await metadataServiceB.createContact('fictional-rls-user-b', {
        mode: 'create',
        name: 'Fictional User B Contact',
        relationship: 'interviewer',
        organization: undefined,
        roleTitle: undefined,
        email: undefined,
        phone: undefined,
        profileUrl: undefined,
      });
      const userBContact = userBApplication.contacts.find(
        ({ name }) => name === 'Fictional User B Contact',
      )!;
      await expect(
        metadataServiceA.createContact('fictional-rls-user-a', {
          mode: 'link',
          contactId: userBContact.id,
          relationship: 'other',
        }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await metadataServiceB.deleteContact('fictional-rls-user-b', userBContact.associationId!);
    },
  );

  testWithAuthenticatedDatabase(
    'keeps document versions immutable while managing names, versions, and application uses',
    async () => {
      let updated = await metadataServiceA.createDocument('fictional-rls-user-a', {
        mode: 'create',
        kind: 'resume',
        title: 'Fictional Product Resume',
        versionLabel: 'v1',
        filename: 'fictional-product-v1.pdf',
        contentSha256: 'a'.repeat(64),
        externalReference: undefined,
        purpose: 'submitted',
        usedAt: '2026-08-01T14:00:00.000Z',
      });
      const firstUse = updated.documents.find(({ label }) => label === 'Fictional Product Resume')!;
      expect(firstUse).toMatchObject({ version: 'v1', purpose: 'submitted' });

      updated = await metadataServiceA.createDocument('fictional-rls-user-a', {
        mode: 'add_version',
        documentId: firstUse.documentId!,
        versionLabel: 'v2',
        filename: 'fictional-product-v2.pdf',
        contentSha256: 'b'.repeat(64),
        externalReference: undefined,
        purpose: 'prepared',
        usedAt: undefined,
      });
      expect(
        updated.documents.filter(({ documentId }) => documentId === firstUse.documentId),
      ).toHaveLength(2);

      updated = await metadataServiceA.updateDocument(
        'fictional-rls-user-a',
        firstUse.documentId!,
        {
          expectedVersion: firstUse.documentVersion!,
          kind: 'resume',
          title: 'Fictional Product Resume — updated name',
        },
      );
      expect(
        updated.documents.find(({ documentId }) => documentId === firstUse.documentId),
      ).toMatchObject({
        label: 'Fictional Product Resume — updated name',
        documentVersion: 2,
      });

      await expect(
        withTestTenant(userASubject!, (tenantDatabase) =>
          tenantDatabase
            .update(documentVersions)
            .set({ versionLabel: 'impermissible rewrite' })
            .where(eq(documentVersions.id, firstUse.documentVersionId!)),
        ),
      ).rejects.toThrow();

      updated = await metadataServiceA.deleteDocumentUse('fictional-rls-user-a', firstUse.useId!);
      expect(updated.documents.map(({ useId }) => useId)).not.toContain(firstUse.useId);
    },
  );

  testWithAuthenticatedDatabase('exports only the authenticated owner tracker', async () => {
    const exported = await trackerDataServiceA.exportJson();
    const serialized = JSON.stringify(exported);
    const csv = await trackerDataServiceA.exportApplicationsCsv();

    expect(exported).toMatchObject({ format: 'wip.tracker.export', formatVersion: 1 });
    expect(serialized).toContain('Fictional Aurora Studio');
    expect(serialized).toContain('Fictional Avery Recruiter');
    expect(serialized).not.toContain('Fictional Birch Works');
    expect(csv).toContain('"company"');
    expect(csv).toContain('"Fictional Aurora Studio"');
    expect(csv).not.toContain('Fictional Birch Works');
  });

  testWithAuthenticatedDatabase(
    'isolates two users even when the other owner UUID is known',
    async () => {
      const guessedRows = await withTestTenant(userASubject!, (tenantDatabase) =>
        tenantDatabase
          .select({ id: applications.id })
          .from(applications)
          .where(eq(applications.ownerId, ownerBId)),
      );
      const userARepository = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userASubject!,
      });
      const userBRepository = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userBSubject!,
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
    'returns not found for cross-user mutations and guessed application UUIDs',
    async () => {
      const userBApplication = await serviceB.createNote('fictional-rls-user-b', {
        body: 'Fictional User B private note.',
      });
      const userBNote = userBApplication.notes.at(-1)!;
      const withAction = await serviceB.createNextAction('fictional-rls-user-b', {
        kind: 'assessment',
        title: 'Complete fictional User B assessment',
        details: undefined,
        dueAt: '2026-08-15T15:00:00.000Z',
      });
      const userBAction = withAction.nextActions!.find(
        ({ title }) => title === 'Complete fictional User B assessment',
      )!;

      await expect(
        serviceA.updateApplication('fictional-rls-user-b', {
          expectedVersion: withAction.version!,
          company: withAction.company,
          role: withAction.role,
          sourceUrl: withAction.sourceUrl,
          sourceName: withAction.sourceName,
          location: withAction.location,
          workplace: 'hybrid',
          requisitionId: withAction.requisitionId,
        }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.recordStageChange(
          'fictional-rls-user-b',
          { stage: 'offer', effectiveAt: '2026-08-16T15:00:00.000Z' },
          `integration-cross-user-stage:${mutationRunId}`,
        ),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.createNote('fictional-rls-user-b', { body: 'Forbidden fictional note.' }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.updateNote('fictional-rls-user-b', userBNote.id, {
          expectedVersion: userBNote.version!,
          body: 'Forbidden fictional note edit.',
        }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.createNextAction('fictional-rls-user-b', {
          kind: 'follow_up',
          title: 'Forbidden fictional action',
          details: undefined,
          dueAt: '2026-08-17T15:00:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.updateNextAction('fictional-rls-user-b', userBAction.id, {
          expectedVersion: userBAction.version!,
          kind: 'assessment',
          title: userBAction.title,
          details: undefined,
          dueAt: userBAction.dueAt,
          state: 'completed',
        }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.deleteApplication('fictional-rls-user-b', {
          confirmation: withAction.company,
        }),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });
      await expect(
        serviceA.recordStageChange(
          '00000000-0000-4000-8000-000000000099',
          { stage: 'rejected', effectiveAt: '2026-08-16T15:00:00.000Z' },
          `integration-guessed-stage:${mutationRunId}`,
        ),
      ).rejects.toMatchObject({ code: 'not_found', status: 404 });

      await serviceB.deleteNote('fictional-rls-user-b', userBNote.id);
      await serviceB.deleteNextAction('fictional-rls-user-b', userBAction.id);
    },
  );

  testWithAuthenticatedDatabase(
    'does not expose the fictional demo seed to authenticated users',
    async () => {
      const repository = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userASubject!,
      });
      const visibleApplications = await repository.listApplications();

      expect(visibleApplications).toHaveLength(1);
      expect(visibleApplications.map((application) => application.id)).not.toContain(
        'cloverfield-digital',
      );
    },
  );

  testWithAuthenticatedDatabase(
    'persists extension capture transactionally, isolates owners, detects duplicates, and replays idempotently',
    async () => {
      const sourceUrl = `https://jobs.example.invalid/integration/${mutationRunId}?utm_source=test`;
      const command = extensionCaptureCommandSchema.parse({
        company: 'Fictional Capture Cooperative',
        role: 'Entry-level Capture Tester',
        stage: 'saved',
        sourceUrl,
        canonicalUrl: `https://jobs.example.invalid/integration/${mutationRunId}`,
        pageTitle: 'Entry-level Capture Tester — Fictional Capture Cooperative',
        location: 'Remote',
        workplace: 'remote',
        employmentType: 'Full-time',
        salaryText: 'Fictional salary range',
        requisitionId: `CAP-${mutationRunId}`,
        descriptionHtml:
          '<section onclick="ignored()"><h2>About</h2><script>ignored()</script><p>Test a fictional user-confirmed extension capture.</p></section>',
        descriptionText:
          'About\n\nTest a fictional user-confirmed extension capture with no real applicant data.',
        extraction: {
          extractorVersion: 'wip-extractor/1.0.0',
          selectedSource: 'json_ld',
          fieldEvidence: {
            role: { source: 'json_ld', confidence: 'high' },
            company: { source: 'json_ld', confidence: 'high' },
            description: { source: 'json_ld', confidence: 'high' },
          },
          warnings: [],
        },
      });
      const serviceA = tenantService(
        userASubject!,
        (tenantDatabase, ownerId) => new NeonExtensionCaptureService(tenantDatabase, ownerId),
      );
      const serviceB = tenantService(
        userBSubject!,
        (tenantDatabase, ownerId) => new NeonExtensionCaptureService(tenantDatabase, ownerId),
      );
      const idempotencyKey = `extension-integration:${mutationRunId}`;

      const first = await serviceA.capture(command, idempotencyKey);
      expect(first).toMatchObject({ status: 'created', idempotentReplay: false });

      const applicationRow = await database!.query.applications.findFirst({
        where: and(
          eq(applications.ownerId, ownerAId),
          eq(applications.publicId, first.application.id),
        ),
      });
      expect(applicationRow).toBeDefined();
      const [persistedEvents, persistedSnapshots] = await Promise.all([
        database!
          .select()
          .from(applicationEvents)
          .where(eq(applicationEvents.applicationId, applicationRow!.id)),
        database!
          .select()
          .from(jobDescriptionSnapshots)
          .where(eq(jobDescriptionSnapshots.applicationId, applicationRow!.id)),
      ]);
      expect(persistedEvents).toHaveLength(1);
      expect(persistedEvents[0]).toMatchObject({
        ownerId: ownerAId,
        source: 'extension',
        confirmationState: 'confirmed',
      });
      expect(persistedSnapshots).toHaveLength(1);
      expect(persistedSnapshots[0]).toMatchObject({
        ownerId: ownerAId,
        captureSource: 'extension',
        extractorVersion: 'wip-extractor/1.0.0',
      });
      expect(persistedSnapshots[0]!.descriptionHtml).not.toMatch(/script|onclick/i);
      expect(persistedSnapshots[0]!.contentSha256).toMatch(/^[0-9a-f]{64}$/);

      await expect(serviceA.capture(command, idempotencyKey)).resolves.toMatchObject({
        status: 'created',
        idempotentReplay: true,
        application: { id: first.application.id },
      });
      await expect(
        serviceA.capture(command, `extension-duplicate:${mutationRunId}`),
      ).resolves.toMatchObject({
        status: 'duplicate',
        application: { id: first.application.id },
        matchedOn: expect.arrayContaining(['source_url', 'requisition_id']),
      });

      const ownerBResult = await serviceB.capture(command, `extension-owner-b:${mutationRunId}`);
      expect(ownerBResult).toMatchObject({ status: 'created', idempotentReplay: false });
      expect(ownerBResult.application.id).not.toBe(first.application.id);

      const [eventCount, snapshotCount] = await Promise.all([
        database!
          .select({ value: count() })
          .from(applicationEvents)
          .where(eq(applicationEvents.applicationId, applicationRow!.id)),
        database!
          .select({ value: count() })
          .from(jobDescriptionSnapshots)
          .where(eq(jobDescriptionSnapshots.applicationId, applicationRow!.id)),
      ]);
      expect(eventCount[0]?.value).toBe(1);
      expect(snapshotCount[0]?.value).toBe(1);
    },
    30_000,
  );

  testWithAuthenticatedDatabase(
    'fails closed for missing and malformed authentication',
    async () => {
      await expect(
        createAuthenticatedNeonApplicationRepository({
          runtimeDatabaseUrl: runtimeDatabaseUrl!,
          clerkUserId: '',
        }),
      ).rejects.toThrow(/verified Clerk subject/i);
    },
  );

  testWithAuthenticatedDatabase(
    'permanently deletes only the selected application and cascades its dependent records',
    async () => {
      const applicationRow = await database!.query.applications.findFirst({
        where: and(
          eq(applications.ownerId, ownerAId),
          eq(applications.publicId, managedApplicationId),
        ),
      });
      expect(applicationRow).toBeDefined();

      await expect(
        serviceA.deleteApplication(managedApplicationId, { confirmation: 'does not match' }),
      ).rejects.toMatchObject({ code: 'validation_error', status: 400 });
      await serviceA.deleteApplication(managedApplicationId, {
        confirmation: 'Fictional Northstar Collective',
      });

      const repository = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userASubject!,
      });
      await expect(repository.getApplicationById(managedApplicationId)).resolves.toBeUndefined();
      const dependentCounts = await Promise.all(
        [applicationEvents, jobDescriptionSnapshots, notes, nextActions].map(async (table) => {
          const [result] = await database!
            .select({ value: count() })
            .from(table)
            .where(eq(table.applicationId, applicationRow!.id));
          return result?.value ?? 0;
        }),
      );
      expect(dependentCounts).toEqual([0, 0, 0, 0]);
    },
  );

  testWithAuthenticatedDatabase(
    'transactionally clears one owner tracker without deleting the owner or another user data',
    async () => {
      await database!
        .update(owners)
        .set({ timezone: 'America/New_York', locale: 'en-US', weekStartsOn: 1 })
        .where(eq(owners.id, ownerAId));
      const result = await trackerDataServiceA.deleteTrackerData({
        confirmation: 'DELETE MY WIP DATA',
      });
      const repositoryA = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userASubject!,
      });
      const repositoryB = await createAuthenticatedNeonApplicationRepository({
        runtimeDatabaseUrl: runtimeDatabaseUrl!,
        clerkUserId: userBSubject!,
      });

      expect(result.applicationsDeleted).toBeGreaterThanOrEqual(1);
      await expect(repositoryA.listApplications()).resolves.toEqual([]);
      await expect(repositoryA.listContacts()).resolves.toEqual([]);
      await expect(repositoryA.listDocuments()).resolves.toEqual([]);
      await expect(repositoryB.getApplicationById('fictional-rls-user-b')).resolves.toBeDefined();
      await expect(
        withTestTenant(userASubject!, async (_database, ownerId) => ownerId),
      ).resolves.toBe(ownerAId);
      const retainedOwner = await database!.query.owners.findFirst({
        where: eq(owners.id, ownerAId),
      });
      expect(retainedOwner).toMatchObject({ timezone: 'UTC', locale: null, weekStartsOn: null });
    },
  );
});
