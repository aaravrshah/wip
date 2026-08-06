import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import {
  applicationEvents,
  applications,
  nextActions,
  notes,
  type WipDatabase,
} from '@wip/database';
import { planManualStageEvent } from '@wip/domain';
import type { Application, TimelineEventKind } from '@wip/domain';
import type {
  CreateApplicationCommand,
  CreateNextActionCommand,
  CreateNoteCommand,
  DeleteApplicationCommand,
  RecordStageChangeCommand,
  UpdateApplicationCommand,
  UpdateNextActionCommand,
  UpdateNoteCommand,
} from '@wip/schemas';
import { and, eq, sql } from 'drizzle-orm';

import { createOwnerScopedNeonApplicationRepository } from '@/data/neon-application-repository';

import { normalizeManualJobDescription } from './snapshot-normalization';
import type { PreparedExtensionSnapshot } from './capture-normalization';
import { conflictError, notFoundError, TrackerError } from './tracker-errors';

export interface CreateApplicationOptions {
  eventSource?: 'manual' | 'extension';
  extensionSnapshot?: PreparedExtensionSnapshot;
  idempotencyPayload?: unknown;
}

export interface ApplicationCommandService {
  createApplication(
    command: CreateApplicationCommand,
    idempotencyKey: string,
    options?: CreateApplicationOptions,
  ): Promise<Application>;
  updateApplication(applicationId: string, command: UpdateApplicationCommand): Promise<Application>;
  recordStageChange(
    applicationId: string,
    command: RecordStageChangeCommand,
    idempotencyKey: string,
  ): Promise<Application>;
  createNote(applicationId: string, command: CreateNoteCommand): Promise<Application>;
  updateNote(
    applicationId: string,
    noteId: string,
    command: UpdateNoteCommand,
  ): Promise<Application>;
  deleteNote(applicationId: string, noteId: string): Promise<Application>;
  createNextAction(applicationId: string, command: CreateNextActionCommand): Promise<Application>;
  updateNextAction(
    applicationId: string,
    actionId: string,
    command: UpdateNextActionCommand,
  ): Promise<Application>;
  deleteNextAction(applicationId: string, actionId: string): Promise<Application>;
  deleteApplication(applicationId: string, command: DeleteApplicationCommand): Promise<void>;
}

function stableCommandUuid(ownerId: string, idempotencyKey: string, resource: string): string {
  const hex = createHash('sha256')
    .update(`wip-command:${ownerId}:${idempotencyKey}:${resource}`)
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

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function databaseEventKind(kind: TimelineEventKind) {
  return kind === 'follow-up' ? ('follow_up' as const) : kind;
}

function databaseActionKind(kind: CreateNextActionCommand['kind']) {
  return kind;
}

export class NeonApplicationCommandService implements ApplicationCommandService {
  private readonly repository;

  constructor(
    private readonly database: WipDatabase,
    private readonly ownerId: string,
  ) {
    this.repository = createOwnerScopedNeonApplicationRepository(database, ownerId);
  }

  private async applicationRow(publicId: string) {
    return this.database.query.applications.findFirst({
      where: and(eq(applications.ownerId, this.ownerId), eq(applications.publicId, publicId)),
    });
  }

  private async applicationOrThrow(publicId: string): Promise<Application> {
    const application = await this.repository.getApplicationById(publicId);
    if (!application) throw notFoundError();
    return application;
  }

  async createApplication(
    command: CreateApplicationCommand,
    idempotencyKey: string,
    options?: CreateApplicationOptions,
  ): Promise<Application> {
    const commandHash = fingerprint(options?.idempotencyPayload ?? command);
    const existing = await this.database.query.applications.findFirst({
      where: and(
        eq(applications.ownerId, this.ownerId),
        eq(applications.createIdempotencyKey, idempotencyKey),
      ),
    });

    if (existing) {
      if (existing.createRequestHash !== commandHash) {
        throw new TrackerError(
          'idempotency_conflict',
          'That idempotency key was already used for a different application.',
          409,
        );
      }
      return this.applicationOrThrow(existing.publicId);
    }

    const applicationId = stableCommandUuid(this.ownerId, idempotencyKey, 'application');
    const eventId = stableCommandUuid(this.ownerId, idempotencyKey, 'initial-event');
    const now = new Date();
    const effectiveAt = now.toISOString();
    const eventPlan = planManualStageEvent({
      stage: command.stage,
      effectiveAt,
      initial: true,
      ...(command.appliedAt ? { appliedAt: command.appliedAt } : {}),
    });

    const insertApplication = this.database
      .insert(applications)
      .values({
        id: applicationId,
        ownerId: this.ownerId,
        publicId: applicationId,
        createIdempotencyKey: idempotencyKey,
        createRequestHash: commandHash,
        lastMutationId: eventId,
        companyName: command.company,
        roleTitle: command.role,
        locationText: command.location ?? '',
        workplace: command.workplace,
        currentStage: command.stage,
        projectedAppliedAt: command.appliedAt ? new Date(command.appliedAt) : null,
        lastConfirmedEventAt: new Date(effectiveAt),
        projectedStageEventId: eventId,
        projectedStageOccurredAt: new Date(effectiveAt),
        waitingOn: eventPlan.payload.waitingOn,
        sourceUrl: command.sourceUrl ?? null,
        sourceName: command.sourceName ?? null,
        requisitionId: command.requisitionId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: applications.id });

    const insertEvent = this.database.execute(sql`
      insert into public.application_events (
        id, owner_id, application_id, event_type, event_kind, title, occurred_at,
        source, confidence, confirmation_state, payload_version, payload,
        idempotency_key, created_by_owner_id
      )
      select
        ${eventId}::uuid, application.owner_id, application.id, ${eventPlan.eventType},
        ${databaseEventKind(eventPlan.eventKind)}::event_kind, ${eventPlan.title},
        ${eventPlan.occurredAt}::timestamptz, ${options?.eventSource ?? 'manual'}::event_source, null,
        'confirmed'::confirmation_state, 1,
        ${JSON.stringify({ ...eventPlan.payload, commandHash })}::jsonb,
        ${idempotencyKey}, application.owner_id
      from public.applications as application
      where application.owner_id = ${this.ownerId}::uuid
        and application.id = ${applicationId}::uuid
        and application.create_request_hash = ${commandHash}
      on conflict do nothing
    `);

    const manualSnapshot = command.jobDescriptionText
      ? normalizeManualJobDescription(command.jobDescriptionText)
      : undefined;
    const snapshot = options?.extensionSnapshot ?? manualSnapshot;
    const insertSnapshot = snapshot
      ? this.database.execute(sql`
          insert into public.job_description_snapshots (
            id, owner_id, application_id, captured_at, capture_source, source_url,
            canonical_url, page_title, description_html, description_text, content_sha256, extractor_version,
            provenance, capture_metadata
          )
          select
            ${stableCommandUuid(this.ownerId, idempotencyKey, 'snapshot')}::uuid,
            application.owner_id, application.id, ${now.toISOString()}::timestamptz,
            ${options?.extensionSnapshot ? 'extension' : 'manual'}::snapshot_capture_source,
            ${options?.extensionSnapshot?.sourceUrl ?? command.sourceUrl ?? null},
            ${options?.extensionSnapshot?.canonicalUrl ?? null},
            ${options?.extensionSnapshot?.pageTitle ?? null}, ${snapshot.html},
            ${snapshot.text}, ${snapshot.contentSha256}, ${snapshot.extractorVersion},
            ${snapshot.provenance},
            ${JSON.stringify(
              options?.extensionSnapshot?.metadata ?? {
                normalization: 'plain-text-to-semantic-html',
              },
            )}::jsonb
          from public.applications as application
          where application.owner_id = ${this.ownerId}::uuid
            and application.id = ${applicationId}::uuid
            and application.create_request_hash = ${commandHash}
          on conflict do nothing
        `)
      : undefined;
    const action = command.nextAction;
    const insertAction = action
      ? this.database.execute(sql`
          insert into public.next_actions (
            id, owner_id, application_id, kind, title, details, due_at, state
          )
          select
            ${stableCommandUuid(this.ownerId, idempotencyKey, 'next-action')}::uuid,
            application.owner_id, application.id, ${databaseActionKind(action.kind)}::next_action_kind,
            ${action.title}, ${action.details ?? null}, ${action.dueAt}::timestamptz,
            'open'::next_action_state
          from public.applications as application
          where application.owner_id = ${this.ownerId}::uuid
            and application.id = ${applicationId}::uuid
            and application.create_request_hash = ${commandHash}
          on conflict do nothing
        `)
      : undefined;

    if (insertSnapshot && insertAction) {
      await this.database.batch([insertApplication, insertEvent, insertSnapshot, insertAction]);
    } else if (insertSnapshot) {
      await this.database.batch([insertApplication, insertEvent, insertSnapshot]);
    } else if (insertAction) {
      await this.database.batch([insertApplication, insertEvent, insertAction]);
    } else {
      await this.database.batch([insertApplication, insertEvent]);
    }

    const persisted = await this.applicationRow(applicationId);
    if (!persisted) throw new Error('Application creation did not persist a readable row.');
    if (persisted.createRequestHash !== commandHash) {
      throw new TrackerError(
        'idempotency_conflict',
        'That idempotency key was concurrently used for a different application.',
        409,
      );
    }
    return this.applicationOrThrow(applicationId);
  }

  async updateApplication(
    applicationId: string,
    command: UpdateApplicationCommand,
  ): Promise<Application> {
    const current = await this.applicationRow(applicationId);
    if (!current) throw notFoundError();
    if (current.version !== command.expectedVersion) throw conflictError();

    const normalized = {
      companyName: command.company,
      roleTitle: command.role,
      locationText: command.location ?? '',
      workplace: command.workplace,
      sourceUrl: command.sourceUrl ?? null,
      sourceName: command.sourceName ?? null,
      requisitionId: command.requisitionId ?? null,
    };
    const changedFields = Object.entries(normalized)
      .filter(([key, value]) => current[key as keyof typeof normalized] !== value)
      .map(([key]) => key);

    if (changedFields.length === 0) return this.applicationOrThrow(applicationId);

    const mutationId = randomUUID();
    const eventId = randomUUID();
    const update = this.database
      .update(applications)
      .set({
        ...normalized,
        version: sql`${applications.version} + 1`,
        lastMutationId: mutationId,
        lastConfirmedEventAt: sql`greatest(${applications.lastConfirmedEventAt}, now())`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(applications.ownerId, this.ownerId),
          eq(applications.id, current.id),
          eq(applications.version, command.expectedVersion),
        ),
      )
      .returning({ id: applications.id });
    const auditEvent = this.database.execute(sql`
      insert into public.application_events (
        id, owner_id, application_id, event_type, event_kind, title, occurred_at,
        source, confidence, confirmation_state, payload_version, payload, created_by_owner_id
      )
      select
        ${eventId}::uuid, ${this.ownerId}::uuid, ${current.id}::uuid,
        'application.facts_updated', 'application'::event_kind, 'Application facts updated', now(),
        'manual'::event_source, null, 'confirmed'::confirmation_state, 1,
        ${JSON.stringify({ changedFields })}::jsonb, ${this.ownerId}::uuid
      from public.applications
      where owner_id = ${this.ownerId}::uuid
        and id = ${current.id}::uuid
        and last_mutation_id = ${mutationId}::uuid
    `);

    const [updatedRows] = await this.database.batch([update, auditEvent]);
    if (updatedRows.length === 0) {
      if (await this.applicationRow(applicationId)) throw conflictError();
      throw notFoundError();
    }
    return this.applicationOrThrow(applicationId);
  }

  async recordStageChange(
    applicationId: string,
    command: RecordStageChangeCommand,
    idempotencyKey: string,
  ): Promise<Application> {
    const commandHash = fingerprint({ applicationId, command });
    const existingEvent = await this.database.query.applicationEvents.findFirst({
      where: and(
        eq(applicationEvents.ownerId, this.ownerId),
        eq(applicationEvents.idempotencyKey, idempotencyKey),
      ),
    });
    if (existingEvent) {
      if (existingEvent.payload.commandHash !== commandHash) {
        throw new TrackerError(
          'idempotency_conflict',
          'That idempotency key was already used for a different stage event.',
          409,
        );
      }
      return this.applicationOrThrow(applicationId);
    }

    const current = await this.applicationRow(applicationId);
    if (!current) throw notFoundError();
    const eventId = stableCommandUuid(this.ownerId, idempotencyKey, 'stage-event');
    const plan = planManualStageEvent({
      stage: command.stage,
      effectiveAt: command.effectiveAt,
      ...(command.stage === 'applied' ? { appliedAt: command.effectiveAt } : {}),
    });
    const insertEvent = this.database
      .insert(applicationEvents)
      .values({
        id: eventId,
        ownerId: this.ownerId,
        applicationId: current.id,
        eventType: plan.eventType,
        eventKind: databaseEventKind(plan.eventKind),
        title: plan.title,
        occurredAt: new Date(plan.occurredAt),
        source: 'manual',
        confirmationState: 'confirmed',
        payloadVersion: 1,
        payload: { ...plan.payload, commandHash },
        idempotencyKey,
        createdByOwnerId: this.ownerId,
      })
      .onConflictDoNothing();
    const projectEvent = this.database.execute(sql`
      with candidate as (
        select event.*, (
          application.projected_stage_occurred_at is null
          or event.occurred_at > application.projected_stage_occurred_at
          or (
            event.occurred_at = application.projected_stage_occurred_at
            and (
              application.projected_stage_created_at is null
              or event.created_at > application.projected_stage_created_at
              or (
                event.created_at = application.projected_stage_created_at
                and event.id::text > coalesce(application.projected_stage_event_id::text, '')
              )
            )
          )
        ) as replaces_projection
        from public.application_events as event
        join public.applications as application
          on application.owner_id = event.owner_id
          and application.id = event.application_id
        where event.owner_id = ${this.ownerId}::uuid
          and event.application_id = ${current.id}::uuid
          and event.id = ${eventId}::uuid
      )
      update public.applications as application
      set
        current_stage = case when event.replaces_projection
          then (event.payload ->> 'targetStage')::application_stage
          else application.current_stage end,
        waiting_on = case when event.replaces_projection
          then (event.payload ->> 'waitingOn')::waiting_on
          else application.waiting_on end,
        projected_stage_event_id = case when event.replaces_projection
          then event.id else application.projected_stage_event_id end,
        projected_stage_occurred_at = case when event.replaces_projection
          then event.occurred_at else application.projected_stage_occurred_at end,
        projected_stage_created_at = case when event.replaces_projection
          then event.created_at else application.projected_stage_created_at end,
        projected_applied_at = case when event.event_type = 'application.submitted'
          then coalesce(least(application.projected_applied_at, event.occurred_at), event.occurred_at)
          else application.projected_applied_at end,
        last_confirmed_event_at = greatest(application.last_confirmed_event_at, event.occurred_at),
        last_mutation_id = event.id,
        version = application.version + 1,
        updated_at = now()
      from candidate as event
      where application.owner_id = ${this.ownerId}::uuid
        and application.id = ${current.id}::uuid
        and event.owner_id = application.owner_id
        and event.application_id = application.id
        and event.id = ${eventId}::uuid
        and application.last_mutation_id is distinct from event.id
    `);

    await this.database.batch([insertEvent, projectEvent]);
    const persistedEvent = await this.database.query.applicationEvents.findFirst({
      where: and(eq(applicationEvents.ownerId, this.ownerId), eq(applicationEvents.id, eventId)),
    });
    if (!persistedEvent) throw new Error('Stage event did not persist.');
    if (persistedEvent.payload.commandHash !== commandHash) {
      throw new TrackerError(
        'idempotency_conflict',
        'That idempotency key was concurrently used for a different stage event.',
        409,
      );
    }
    return this.applicationOrThrow(applicationId);
  }

  async createNote(applicationId: string, command: CreateNoteCommand): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    await this.database.insert(notes).values({
      id: randomUUID(),
      ownerId: this.ownerId,
      applicationId: application.id,
      body: command.body,
    });
    return this.applicationOrThrow(applicationId);
  }

  async updateNote(
    applicationId: string,
    noteId: string,
    command: UpdateNoteCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    const updated = await this.database
      .update(notes)
      .set({ body: command.body, version: sql`${notes.version} + 1`, updatedAt: sql`now()` })
      .where(
        and(
          eq(notes.ownerId, this.ownerId),
          eq(notes.applicationId, application.id),
          eq(notes.id, noteId),
          eq(notes.version, command.expectedVersion),
        ),
      )
      .returning({ id: notes.id });
    if (updated.length === 0) {
      const existing = await this.database.query.notes.findFirst({
        where: and(eq(notes.ownerId, this.ownerId), eq(notes.id, noteId)),
      });
      if (existing) throw conflictError('This note changed in another tab. Refresh and retry.');
      throw notFoundError();
    }
    return this.applicationOrThrow(applicationId);
  }

  async deleteNote(applicationId: string, noteId: string): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    const removed = await this.database
      .delete(notes)
      .where(
        and(
          eq(notes.ownerId, this.ownerId),
          eq(notes.applicationId, application.id),
          eq(notes.id, noteId),
        ),
      )
      .returning({ id: notes.id });
    if (removed.length === 0) throw notFoundError();
    return this.applicationOrThrow(applicationId);
  }

  async createNextAction(
    applicationId: string,
    command: CreateNextActionCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    await this.database.insert(nextActions).values({
      id: randomUUID(),
      ownerId: this.ownerId,
      applicationId: application.id,
      kind: command.kind,
      title: command.title,
      details: command.details ?? null,
      dueAt: new Date(command.dueAt),
      state: 'open',
    });
    return this.applicationOrThrow(applicationId);
  }

  async updateNextAction(
    applicationId: string,
    actionId: string,
    command: UpdateNextActionCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    const updated = await this.database
      .update(nextActions)
      .set({
        kind: command.kind,
        title: command.title,
        details: command.details ?? null,
        dueAt: new Date(command.dueAt),
        state: command.state,
        completedAt: command.state === 'completed' ? sql`now()` : null,
        version: sql`${nextActions.version} + 1`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(nextActions.ownerId, this.ownerId),
          eq(nextActions.applicationId, application.id),
          eq(nextActions.id, actionId),
          eq(nextActions.version, command.expectedVersion),
        ),
      )
      .returning({ id: nextActions.id });
    if (updated.length === 0) {
      const existing = await this.database.query.nextActions.findFirst({
        where: and(eq(nextActions.ownerId, this.ownerId), eq(nextActions.id, actionId)),
      });
      if (existing)
        throw conflictError('This next action changed in another tab. Refresh and retry.');
      throw notFoundError();
    }
    return this.applicationOrThrow(applicationId);
  }

  async deleteNextAction(applicationId: string, actionId: string): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    const removed = await this.database
      .delete(nextActions)
      .where(
        and(
          eq(nextActions.ownerId, this.ownerId),
          eq(nextActions.applicationId, application.id),
          eq(nextActions.id, actionId),
        ),
      )
      .returning({ id: nextActions.id });
    if (removed.length === 0) throw notFoundError();
    return this.applicationOrThrow(applicationId);
  }

  async deleteApplication(applicationId: string, command: DeleteApplicationCommand): Promise<void> {
    const application = await this.applicationRow(applicationId);
    if (!application) throw notFoundError();
    if (![application.companyName, application.roleTitle].includes(command.confirmation)) {
      throw new TrackerError(
        'validation_error',
        'Type the company or role exactly to confirm permanent deletion.',
        400,
        { confirmation: ['The confirmation does not match the company or role.'] },
      );
    }
    const removed = await this.database
      .delete(applications)
      .where(and(eq(applications.ownerId, this.ownerId), eq(applications.id, application.id)))
      .returning({ id: applications.id });
    if (removed.length === 0) throw notFoundError();
  }
}

export class DemoReadOnlyCommandService implements ApplicationCommandService {
  private reject(): never {
    throw new TrackerError(
      'demo_read_only',
      'The fictional demo is read-only. Switch to Clerk + Neon mode to save changes.',
      403,
    );
  }

  async createApplication(): Promise<Application> {
    this.reject();
  }
  async updateApplication(): Promise<Application> {
    this.reject();
  }
  async recordStageChange(): Promise<Application> {
    this.reject();
  }
  async createNote(): Promise<Application> {
    this.reject();
  }
  async updateNote(): Promise<Application> {
    this.reject();
  }
  async deleteNote(): Promise<Application> {
    this.reject();
  }
  async createNextAction(): Promise<Application> {
    this.reject();
  }
  async updateNextAction(): Promise<Application> {
    this.reject();
  }
  async deleteNextAction(): Promise<Application> {
    this.reject();
  }
  async deleteApplication(): Promise<void> {
    this.reject();
  }
}
