import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const applicationStageEnum = pgEnum('application_stage', [
  'saved',
  'preparing',
  'applied',
  'assessment',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
]);

export const workplaceEnum = pgEnum('workplace', ['hybrid', 'on_site', 'remote']);
export const waitingOnEnum = pgEnum('waiting_on', ['candidate', 'employer', 'none']);
export const eventKindEnum = pgEnum('event_kind', [
  'application',
  'assessment',
  'document',
  'employer',
  'follow_up',
  'interview',
  'offer',
  'status',
]);
export const eventSourceEnum = pgEnum('event_source', [
  'manual',
  'demo_seed',
  'extension',
  'email_extraction',
  'import',
  'system',
]);
export const confirmationStateEnum = pgEnum('confirmation_state', [
  'pending',
  'confirmed',
  'rejected',
  'not_required',
]);
export const snapshotCaptureSourceEnum = pgEnum('snapshot_capture_source', [
  'manual',
  'demo_seed',
  'extension',
  'import',
]);
export const documentKindEnum = pgEnum('document_kind', [
  'resume',
  'cover_letter',
  'portfolio',
  'other',
]);
export const documentUsePurposeEnum = pgEnum('document_use_purpose', [
  'prepared',
  'submitted',
  'shared',
]);
export const nextActionKindEnum = pgEnum('next_action_kind', [
  'assessment',
  'decision',
  'follow_up',
  'interview',
  'prepare',
  'other',
]);
export const nextActionStateEnum = pgEnum('next_action_state', ['open', 'completed', 'cancelled']);

const utcTimestamp = (name: string) => timestamp(name, { mode: 'date', withTimezone: true });

export const authenticatedRole = pgRole('authenticated').existing();

const ownerReadPolicy = (name: string, ownerId: AnyPgColumn) =>
  pgPolicy(name, {
    for: 'select',
    to: authenticatedRole,
    using: sql`${ownerId} = (select public.wip_current_owner_id())`,
  });

export const owners = pgTable(
  'owners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authProvider: text('auth_provider'),
    authSubject: text('auth_subject'),
    timezone: text('timezone').notNull().default('UTC'),
    locale: text('locale'),
    weekStartsOn: smallint('week_starts_on'),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
    updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('owners_auth_identity_unique')
      .on(table.authProvider, table.authSubject)
      .where(sql`${table.authProvider} is not null and ${table.authSubject} is not null`),
    uniqueIndex('owners_clerk_subject_unique')
      .on(table.authSubject)
      .where(sql`${table.authProvider} = 'clerk'`),
    check(
      'owners_week_starts_on_check',
      sql`${table.weekStartsOn} is null or ${table.weekStartsOn} between 0 and 6`,
    ),
    pgPolicy('owners_clerk_identity_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.authProvider} = 'clerk' and ${table.authSubject} = (select auth.user_id())`,
    }),
  ],
).enableRLS();

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    publicId: text('public_id').notNull(),
    companyName: text('company_name').notNull(),
    roleTitle: text('role_title').notNull(),
    locationText: text('location_text').notNull(),
    workplace: workplaceEnum('workplace').notNull(),
    currentStage: applicationStageEnum('current_stage').notNull(),
    projectedAppliedAt: utcTimestamp('projected_applied_at'),
    lastConfirmedEventAt: utcTimestamp('last_confirmed_event_at').notNull(),
    waitingOn: waitingOnEnum('waiting_on').notNull().default('none'),
    sourceUrl: text('source_url'),
    sourceName: text('source_name'),
    requisitionId: text('requisition_id'),
    archivedAt: utcTimestamp('archived_at'),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
    updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('applications_owner_id_id_unique').on(table.ownerId, table.id),
    unique('applications_owner_public_id_unique').on(table.ownerId, table.publicId),
    index('applications_owner_stage_updated_idx').on(
      table.ownerId,
      table.currentStage,
      table.updatedAt,
    ),
    index('applications_owner_last_event_idx').on(table.ownerId, table.lastConfirmedEventAt),
    ownerReadPolicy('applications_owner_select', table.ownerId),
  ],
).enableRLS();

export const applicationEvents = pgTable(
  'application_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    eventType: text('event_type').notNull(),
    eventKind: eventKindEnum('event_kind').notNull(),
    title: text('title').notNull(),
    details: text('details'),
    occurredAt: utcTimestamp('occurred_at').notNull(),
    source: eventSourceEnum('source').notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    confirmationState: confirmationStateEnum('confirmation_state').notNull(),
    payloadVersion: smallint('payload_version').notNull().default(1),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    sourceReferenceType: text('source_reference_type'),
    sourceReferenceId: uuid('source_reference_id'),
    supersedesEventId: uuid('supersedes_event_id'),
    idempotencyKey: text('idempotency_key'),
    createdByOwnerId: uuid('created_by_owner_id').references(() => owners.id, {
      onDelete: 'set null',
    }),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('application_events_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.applicationId],
      foreignColumns: [applications.ownerId, applications.id],
      name: 'application_events_owner_application_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ownerId, table.supersedesEventId],
      foreignColumns: [table.ownerId, table.id],
      name: 'application_events_owner_supersedes_fk',
    }),
    uniqueIndex('application_events_owner_idempotency_unique')
      .on(table.ownerId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index('application_events_owner_application_occurred_idx').on(
      table.ownerId,
      table.applicationId,
      table.occurredAt,
      table.createdAt,
    ),
    check(
      'application_events_confidence_check',
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
    check('application_events_payload_version_check', sql`${table.payloadVersion} > 0`),
    ownerReadPolicy('application_events_owner_select', table.ownerId),
  ],
).enableRLS();

export const jobDescriptionSnapshots = pgTable(
  'job_description_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    capturedAt: utcTimestamp('captured_at').notNull(),
    captureSource: snapshotCaptureSourceEnum('capture_source').notNull(),
    sourceUrl: text('source_url'),
    canonicalUrl: text('canonical_url'),
    pageTitle: text('page_title'),
    descriptionHtml: text('description_html').notNull(),
    descriptionText: text('description_text').notNull(),
    contentSha256: text('content_sha256').notNull(),
    extractorVersion: text('extractor_version').notNull(),
    provenance: text('provenance').notNull(),
    captureMetadata: jsonb('capture_metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('job_snapshots_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.applicationId],
      foreignColumns: [applications.ownerId, applications.id],
      name: 'job_snapshots_owner_application_fk',
    }).onDelete('cascade'),
    unique('job_snapshots_owner_application_hash_unique').on(
      table.ownerId,
      table.applicationId,
      table.contentSha256,
    ),
    index('job_snapshots_owner_application_captured_idx').on(
      table.ownerId,
      table.applicationId,
      table.capturedAt,
    ),
    check(
      'job_snapshots_sha256_check',
      sql`char_length(${table.contentSha256}) = 64 and ${table.contentSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    ownerReadPolicy('job_description_snapshots_owner_select', table.ownerId),
  ],
).enableRLS();

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    title: text('title').notNull(),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
    updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('documents_owner_id_id_unique').on(table.ownerId, table.id),
    index('documents_owner_kind_idx').on(table.ownerId, table.kind),
    ownerReadPolicy('documents_owner_select', table.ownerId),
  ],
).enableRLS();

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    versionLabel: text('version_label').notNull(),
    filename: text('filename'),
    contentSha256: text('content_sha256'),
    externalReference: text('external_reference'),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('document_versions_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.documentId],
      foreignColumns: [documents.ownerId, documents.id],
      name: 'document_versions_owner_document_fk',
    }).onDelete('cascade'),
    unique('document_versions_owner_document_label_unique').on(
      table.ownerId,
      table.documentId,
      table.versionLabel,
    ),
    index('document_versions_owner_document_created_idx').on(
      table.ownerId,
      table.documentId,
      table.createdAt,
    ),
    check(
      'document_versions_sha256_check',
      sql`${table.contentSha256} is null or (char_length(${table.contentSha256}) = 64 and ${table.contentSha256} ~ '^[0-9a-f]{64}$')`,
    ),
    ownerReadPolicy('document_versions_owner_select', table.ownerId),
  ],
).enableRLS();

export const applicationDocumentUses = pgTable(
  'application_document_uses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    documentVersionId: uuid('document_version_id').notNull(),
    purpose: documentUsePurposeEnum('purpose').notNull(),
    usedAt: utcTimestamp('used_at'),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('application_document_uses_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.applicationId],
      foreignColumns: [applications.ownerId, applications.id],
      name: 'application_document_uses_owner_application_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ownerId, table.documentVersionId],
      foreignColumns: [documentVersions.ownerId, documentVersions.id],
      name: 'application_document_uses_owner_version_fk',
    }).onDelete('cascade'),
    unique('application_document_uses_unique').on(
      table.ownerId,
      table.applicationId,
      table.documentVersionId,
      table.purpose,
    ),
    index('application_document_uses_owner_application_idx').on(table.ownerId, table.applicationId),
    ownerReadPolicy('application_document_uses_owner_select', table.ownerId),
  ],
).enableRLS();

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    email: text('email'),
    organization: text('organization'),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
    updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('contacts_owner_id_id_unique').on(table.ownerId, table.id),
    index('contacts_owner_name_idx').on(table.ownerId, table.displayName),
    ownerReadPolicy('contacts_owner_select', table.ownerId),
  ],
).enableRLS();

export const applicationContacts = pgTable(
  'application_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    contactId: uuid('contact_id').notNull(),
    relationship: text('relationship').notNull(),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('application_contacts_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.applicationId],
      foreignColumns: [applications.ownerId, applications.id],
      name: 'application_contacts_owner_application_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.ownerId, table.contactId],
      foreignColumns: [contacts.ownerId, contacts.id],
      name: 'application_contacts_owner_contact_fk',
    }).onDelete('cascade'),
    unique('application_contacts_unique').on(table.ownerId, table.applicationId, table.contactId),
    index('application_contacts_owner_application_idx').on(table.ownerId, table.applicationId),
    ownerReadPolicy('application_contacts_owner_select', table.ownerId),
  ],
).enableRLS();

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    body: text('body').notNull(),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
    updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('notes_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.applicationId],
      foreignColumns: [applications.ownerId, applications.id],
      name: 'notes_owner_application_fk',
    }).onDelete('cascade'),
    index('notes_owner_application_created_idx').on(
      table.ownerId,
      table.applicationId,
      table.createdAt,
    ),
    ownerReadPolicy('notes_owner_select', table.ownerId),
  ],
).enableRLS();

export const nextActions = pgTable(
  'next_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    kind: nextActionKindEnum('kind').notNull(),
    title: text('title').notNull(),
    details: text('details'),
    dueAt: utcTimestamp('due_at').notNull(),
    state: nextActionStateEnum('state').notNull().default('open'),
    completedAt: utcTimestamp('completed_at'),
    createdAt: utcTimestamp('created_at').notNull().defaultNow(),
    updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('next_actions_owner_id_id_unique').on(table.ownerId, table.id),
    foreignKey({
      columns: [table.ownerId, table.applicationId],
      foreignColumns: [applications.ownerId, applications.id],
      name: 'next_actions_owner_application_fk',
    }).onDelete('cascade'),
    index('next_actions_owner_state_due_idx').on(table.ownerId, table.state, table.dueAt),
    index('next_actions_owner_application_idx').on(table.ownerId, table.applicationId),
    check(
      'next_actions_completion_check',
      sql`(${table.state} = 'completed' and ${table.completedAt} is not null) or (${table.state} <> 'completed')`,
    ),
    ownerReadPolicy('next_actions_owner_select', table.ownerId),
  ],
).enableRLS();

export const ownedTables = {
  applicationContacts,
  applicationDocumentUses,
  applicationEvents,
  applications,
  contacts,
  documentVersions,
  documents,
  jobDescriptionSnapshots,
  nextActions,
  notes,
};
