import 'server-only';

import { createHash } from 'node:crypto';

import { applications, jobDescriptionSnapshots, type WipDatabase } from '@wip/database';
import type { Application } from '@wip/domain';
import type {
  CreateApplicationCommand,
  ExtensionCaptureCommand,
  ExtensionCaptureResponse,
  ExtensionSnapshotAttachmentCommand,
  ExtensionSnapshotAttachmentResponse,
} from '@wip/schemas';
import { and, eq, sql } from 'drizzle-orm';

import { createOwnerScopedNeonApplicationRepository } from '@/data/neon-application-repository';

import { NeonApplicationCommandService } from './application-command-service';
import { normalizeCaptureUrl, prepareExtensionCapture } from './capture-normalization';
import { TrackerError } from './tracker-errors';

export interface ExtensionCaptureService {
  capture(
    command: ExtensionCaptureCommand,
    idempotencyKey: string,
  ): Promise<ExtensionCaptureResponse>;
  attachSnapshot(
    command: ExtensionSnapshotAttachmentCommand,
    idempotencyKey: string,
  ): Promise<ExtensionSnapshotAttachmentResponse>;
}

function applicationSummary(application: Application) {
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    stage: application.stage,
    path: `/applications/${application.id}`,
  } as const;
}

function normalizedCompany(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

function safeNormalizeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return normalizeCaptureUrl(value);
  } catch {
    return undefined;
  }
}

function stableCaptureUuid(ownerId: string, idempotencyKey: string, resource: string): string {
  const hex = createHash('sha256')
    .update(`wip-extension:${ownerId}:${idempotencyKey}:${resource}`)
    .digest('hex');
  const variant = (Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant.toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function captureFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export class NeonExtensionCaptureService implements ExtensionCaptureService {
  private readonly repository;
  private readonly applicationCommands;

  constructor(
    private readonly database: WipDatabase,
    private readonly ownerId: string,
  ) {
    this.repository = createOwnerScopedNeonApplicationRepository(database, ownerId);
    this.applicationCommands = new NeonApplicationCommandService(database, ownerId);
  }

  private async applicationOrThrow(publicId: string): Promise<Application> {
    const application = await this.repository.getApplicationById(publicId);
    if (!application) {
      throw new Error('A capture application row was not readable after persistence.');
    }
    return application;
  }

  async capture(
    command: ExtensionCaptureCommand,
    idempotencyKey: string,
  ): Promise<ExtensionCaptureResponse> {
    const prepared = prepareExtensionCapture(command);
    const createCommand: CreateApplicationCommand = {
      company: command.company,
      role: command.role,
      stage: command.stage,
      sourceUrl: prepared.applicationSourceUrl,
      sourceName: new URL(prepared.applicationSourceUrl).hostname,
      location: command.location,
      workplace: command.workplace,
      requisitionId: command.requisitionId,
      jobDescriptionText: undefined,
    };
    const createOptions = {
      eventSource: 'extension' as const,
      extensionSnapshot: prepared.snapshot,
      idempotencyPayload: command,
    };

    const targetUrls = new Set(
      [
        prepared.applicationSourceUrl,
        prepared.snapshot.sourceUrl,
        prepared.snapshot.canonicalUrl,
      ].filter((value): value is string => Boolean(value)),
    );
    const targetRequisition = command.requisitionId?.trim().toLocaleLowerCase('en');
    const duplicateLockKeys = [
      ...[...targetUrls].map((url) => `url:${url}`),
      ...(targetRequisition
        ? [`req:${normalizedCompany(command.company)}:${targetRequisition}`]
        : []),
    ]
      .map((key) => `wip-capture:${this.ownerId}:${key}`)
      .sort();
    for (const key of duplicateLockKeys) {
      await this.database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    }

    const replay = await this.database.query.applications.findFirst({
      where: and(
        eq(applications.ownerId, this.ownerId),
        eq(applications.createIdempotencyKey, idempotencyKey),
      ),
    });
    if (replay) {
      const application = await this.applicationCommands.createApplication(
        createCommand,
        idempotencyKey,
        createOptions,
      );
      return {
        status: 'created',
        application: applicationSummary(application),
        idempotentReplay: true,
      };
    }

    const candidates = await this.database
      .select({
        publicId: applications.publicId,
        companyName: applications.companyName,
        sourceUrl: applications.sourceUrl,
        requisitionId: applications.requisitionId,
        snapshotSourceUrl: jobDescriptionSnapshots.sourceUrl,
        canonicalUrl: jobDescriptionSnapshots.canonicalUrl,
      })
      .from(applications)
      .leftJoin(
        jobDescriptionSnapshots,
        and(
          eq(applications.ownerId, jobDescriptionSnapshots.ownerId),
          eq(applications.id, jobDescriptionSnapshots.applicationId),
        ),
      )
      .where(eq(applications.ownerId, this.ownerId));

    for (const candidate of candidates) {
      const matchedOn: Array<'source_url' | 'requisition_id'> = [];
      const candidateUrls = [
        candidate.sourceUrl,
        candidate.snapshotSourceUrl,
        candidate.canonicalUrl,
      ]
        .map(safeNormalizeUrl)
        .filter((value): value is string => Boolean(value));
      if (candidateUrls.some((value) => targetUrls.has(value))) matchedOn.push('source_url');
      if (
        targetRequisition &&
        candidate.requisitionId?.trim().toLocaleLowerCase('en') === targetRequisition &&
        normalizedCompany(candidate.companyName) === normalizedCompany(command.company)
      ) {
        matchedOn.push('requisition_id');
      }
      if (matchedOn.length > 0) {
        const application = await this.applicationOrThrow(candidate.publicId);
        return { status: 'duplicate', application: applicationSummary(application), matchedOn };
      }
    }

    const application = await this.applicationCommands.createApplication(
      createCommand,
      idempotencyKey,
      createOptions,
    );
    return {
      status: 'created',
      application: applicationSummary(application),
      idempotentReplay: false,
    };
  }

  async attachSnapshot(
    command: ExtensionSnapshotAttachmentCommand,
    idempotencyKey: string,
  ): Promise<ExtensionSnapshotAttachmentResponse> {
    const applicationRow = await this.database.query.applications.findFirst({
      where: and(
        eq(applications.ownerId, this.ownerId),
        eq(applications.publicId, command.applicationId),
      ),
    });
    if (!applicationRow) {
      throw new TrackerError('not_found', 'That application was not found.', 404);
    }

    const prepared = prepareExtensionCapture(command);
    const requestHash = captureFingerprint(command);
    const snapshotId = stableCaptureUuid(this.ownerId, idempotencyKey, 'snapshot');
    const eventId = stableCaptureUuid(this.ownerId, idempotencyKey, 'snapshot-event');
    const attachmentLockKeys = [
      `wip-attachment:${this.ownerId}:idempotency:${idempotencyKey}`,
      `wip-attachment:${this.ownerId}:content:${applicationRow.id}:${prepared.snapshot.contentSha256}`,
    ].sort();
    for (const key of attachmentLockKeys) {
      await this.database.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    }
    const existingIdempotent = await this.database.query.jobDescriptionSnapshots.findFirst({
      where: and(
        eq(jobDescriptionSnapshots.ownerId, this.ownerId),
        eq(jobDescriptionSnapshots.id, snapshotId),
      ),
    });
    if (existingIdempotent) {
      if (
        existingIdempotent.contentSha256 !== prepared.snapshot.contentSha256 ||
        existingIdempotent.captureMetadata.attachmentRequestHash !== requestHash
      ) {
        throw new TrackerError(
          'idempotency_conflict',
          'That idempotency key was already used for a different snapshot.',
          409,
        );
      }
      const application = await this.applicationOrThrow(applicationRow.publicId);
      return {
        status: 'snapshot_attached',
        application: applicationSummary(application),
        snapshot: {
          id: existingIdempotent.id,
          contentSha256: existingIdempotent.contentSha256,
          capturedAt: existingIdempotent.capturedAt.toISOString(),
        },
        created: false,
        idempotentReplay: true,
      };
    }

    const existingContent = await this.database.query.jobDescriptionSnapshots.findFirst({
      where: and(
        eq(jobDescriptionSnapshots.ownerId, this.ownerId),
        eq(jobDescriptionSnapshots.applicationId, applicationRow.id),
        eq(jobDescriptionSnapshots.contentSha256, prepared.snapshot.contentSha256),
      ),
    });
    if (existingContent) {
      const application = await this.applicationOrThrow(applicationRow.publicId);
      return {
        status: 'snapshot_attached',
        application: applicationSummary(application),
        snapshot: {
          id: existingContent.id,
          contentSha256: existingContent.contentSha256,
          capturedAt: existingContent.capturedAt.toISOString(),
        },
        created: false,
        idempotentReplay: false,
      };
    }

    const capturedAt = new Date();
    const inserted = await this.database.execute<{ id: string }>(sql`
      insert into public.job_description_snapshots (
        id, owner_id, application_id, captured_at, capture_source, source_url, canonical_url,
        page_title, description_html, description_text, content_sha256, extractor_version,
        provenance, capture_metadata
      )
      values (
        ${snapshotId}::uuid, ${this.ownerId}::uuid, ${applicationRow.id}::uuid,
        ${capturedAt.toISOString()}::timestamptz, 'extension'::snapshot_capture_source,
        ${prepared.snapshot.sourceUrl}, ${prepared.snapshot.canonicalUrl ?? null},
        ${prepared.snapshot.pageTitle ?? null}, ${prepared.snapshot.html}, ${prepared.snapshot.text},
        ${prepared.snapshot.contentSha256}, ${prepared.snapshot.extractorVersion},
        ${prepared.snapshot.provenance},
        ${JSON.stringify({ ...prepared.snapshot.metadata, attachmentRequestHash: requestHash })}::jsonb
      )
      on conflict do nothing
      returning id
    `);

    if (inserted.rows.length === 0) {
      const raced = await this.database.query.jobDescriptionSnapshots.findFirst({
        where: and(
          eq(jobDescriptionSnapshots.ownerId, this.ownerId),
          eq(jobDescriptionSnapshots.applicationId, applicationRow.id),
          eq(jobDescriptionSnapshots.contentSha256, prepared.snapshot.contentSha256),
        ),
      });
      if (!raced) throw new Error('Snapshot attachment conflicted without a readable snapshot.');
      const application = await this.applicationOrThrow(applicationRow.publicId);
      return {
        status: 'snapshot_attached',
        application: applicationSummary(application),
        snapshot: {
          id: raced.id,
          contentSha256: raced.contentSha256,
          capturedAt: raced.capturedAt.toISOString(),
        },
        created: false,
        idempotentReplay: false,
      };
    }

    await this.database.batch([
      this.database.execute(sql`
        insert into public.application_events (
          id, owner_id, application_id, event_type, event_kind, title, occurred_at, source,
          confidence, confirmation_state, payload_version, payload, source_reference_type,
          source_reference_id, idempotency_key, created_by_owner_id
        )
        values (
          ${eventId}::uuid, ${this.ownerId}::uuid, ${applicationRow.id}::uuid,
          'job_description.snapshot_attached', 'document'::event_kind,
          'Job description snapshot attached', ${capturedAt.toISOString()}::timestamptz,
          'extension'::event_source, null, 'confirmed'::confirmation_state, 1,
          ${JSON.stringify({ snapshotId, contentSha256: prepared.snapshot.contentSha256 })}::jsonb,
          'extension_snapshot', ${snapshotId}::uuid, ${idempotencyKey}, ${this.ownerId}::uuid
        )
        on conflict do nothing
      `),
      this.database.execute(sql`
        update public.applications
        set
          last_confirmed_event_at = greatest(last_confirmed_event_at, ${capturedAt.toISOString()}::timestamptz),
          updated_at = now(),
          version = version + 1,
          last_mutation_id = ${eventId}::uuid
        where owner_id = ${this.ownerId}::uuid and id = ${applicationRow.id}::uuid
      `),
    ]);

    const application = await this.applicationOrThrow(applicationRow.publicId);
    return {
      status: 'snapshot_attached',
      application: applicationSummary(application),
      snapshot: {
        id: snapshotId,
        contentSha256: prepared.snapshot.contentSha256,
        capturedAt: capturedAt.toISOString(),
      },
      created: true,
      idempotentReplay: false,
    };
  }
}

export class DemoReadOnlyExtensionCaptureService implements ExtensionCaptureService {
  async capture(): Promise<ExtensionCaptureResponse> {
    throw new TrackerError(
      'demo_read_only',
      'The fictional demo is read-only. Configure Clerk and Neon to save a capture.',
      403,
    );
  }

  async attachSnapshot(): Promise<ExtensionSnapshotAttachmentResponse> {
    throw new TrackerError(
      'demo_read_only',
      'The fictional demo is read-only. Configure Clerk and Neon to attach a snapshot.',
      403,
    );
  }
}
