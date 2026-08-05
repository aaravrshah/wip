import 'server-only';

import {
  applicationContacts,
  applicationDocumentUses,
  applicationEvents,
  applications,
  contacts,
  createAuthenticatedDatabase,
  documentVersions,
  documents,
  jobDescriptionSnapshots,
  nextActions,
  notes,
} from '@wip/database';
import type { createDatabase } from '@wip/database';
import type {
  Application,
  ApplicationNote,
  Contact,
  DocumentVersion,
  JobSnapshot,
  NextAction,
  TimelineEvent,
} from '@wip/domain';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import type { ApplicationRepository } from './application-repository';

type Database = ReturnType<typeof createDatabase>;

function iso(value: Date): string {
  return value.toISOString();
}

function groupByApplicationId<T extends { applicationId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const current = grouped.get(row.applicationId) ?? [];
    current.push(row);
    grouped.set(row.applicationId, current);
  }

  return grouped;
}

function eventKind(kind: (typeof applicationEvents.$inferSelect)['eventKind']) {
  return kind === 'follow_up' ? 'follow-up' : kind;
}

function eventSource(source: (typeof applicationEvents.$inferSelect)['source']) {
  const labels = {
    demo_seed: 'Demo seed',
    email_extraction: 'Email extraction',
    extension: 'Extension',
    import: 'Import',
    manual: 'Manual',
    system: 'System',
  } as const;
  return labels[source];
}

function documentKind(kind: (typeof documents.$inferSelect)['kind']): DocumentVersion['kind'] {
  const labels = {
    cover_letter: 'Cover letter',
    other: 'Other',
    portfolio: 'Portfolio',
    resume: 'Resume',
  } as const;
  return labels[kind];
}

function actionKind(kind: (typeof nextActions.$inferSelect)['kind']): NextAction['kind'] {
  return kind === 'follow_up' ? 'follow-up' : kind;
}

export async function createAuthenticatedNeonApplicationRepository({
  authenticatedDatabaseUrl,
  databaseToken,
}: {
  authenticatedDatabaseUrl: string;
  databaseToken: string;
}): Promise<ApplicationRepository> {
  if (!databaseToken.trim()) {
    throw new Error('A verified database token is required.');
  }

  const database = createAuthenticatedDatabase(authenticatedDatabaseUrl, databaseToken);
  const ownerId = await provisionAuthenticatedOwner(database);

  return createOwnerScopedNeonApplicationRepositoryForTooling(database, ownerId);
}

export async function provisionAuthenticatedOwner(database: Database): Promise<string> {
  const result = await database.execute<{ ownerId: string }>(
    sql`select public.wip_provision_owner() as "ownerId"`,
  );
  const ownerId = result.rows[0]?.ownerId;

  if (!ownerId) {
    throw new Error('Authenticated owner provisioning did not return an owner identifier.');
  }

  return ownerId;
}

// This explicit-owner adapter is reserved for trusted migrations, seed tooling, and integration
// tests. Authenticated web requests must use createAuthenticatedNeonApplicationRepository so the
// owner comes from Neon's verified JWT context instead of caller input.
export function createOwnerScopedNeonApplicationRepositoryForTooling(
  database: Database,
  ownerId: string,
): ApplicationRepository {
  async function listApplications(): Promise<Application[]> {
    const [
      applicationRows,
      eventRows,
      snapshotRows,
      documentUseRows,
      contactRows,
      noteRows,
      actionRows,
    ] = await Promise.all([
      database
        .select()
        .from(applications)
        .where(eq(applications.ownerId, ownerId))
        .orderBy(desc(applications.updatedAt)),
      database
        .select()
        .from(applicationEvents)
        .where(eq(applicationEvents.ownerId, ownerId))
        .orderBy(asc(applicationEvents.occurredAt), asc(applicationEvents.createdAt)),
      database
        .select()
        .from(jobDescriptionSnapshots)
        .where(eq(jobDescriptionSnapshots.ownerId, ownerId))
        .orderBy(desc(jobDescriptionSnapshots.capturedAt)),
      database
        .select({
          applicationId: applicationDocumentUses.applicationId,
          purpose: applicationDocumentUses.purpose,
          usedAt: applicationDocumentUses.usedAt,
          kind: documents.kind,
          title: documents.title,
          filename: documentVersions.filename,
          versionLabel: documentVersions.versionLabel,
        })
        .from(applicationDocumentUses)
        .innerJoin(
          documentVersions,
          and(
            eq(applicationDocumentUses.ownerId, documentVersions.ownerId),
            eq(applicationDocumentUses.documentVersionId, documentVersions.id),
          ),
        )
        .innerJoin(
          documents,
          and(
            eq(documentVersions.ownerId, documents.ownerId),
            eq(documentVersions.documentId, documents.id),
          ),
        )
        .where(eq(applicationDocumentUses.ownerId, ownerId))
        .orderBy(asc(applicationDocumentUses.createdAt)),
      database
        .select({
          applicationId: applicationContacts.applicationId,
          contactId: contacts.id,
          displayName: contacts.displayName,
          email: contacts.email,
          relationship: applicationContacts.relationship,
        })
        .from(applicationContacts)
        .innerJoin(
          contacts,
          and(
            eq(applicationContacts.ownerId, contacts.ownerId),
            eq(applicationContacts.contactId, contacts.id),
          ),
        )
        .where(eq(applicationContacts.ownerId, ownerId))
        .orderBy(asc(applicationContacts.createdAt)),
      database.select().from(notes).where(eq(notes.ownerId, ownerId)).orderBy(asc(notes.createdAt)),
      database
        .select()
        .from(nextActions)
        .where(and(eq(nextActions.ownerId, ownerId), eq(nextActions.state, 'open')))
        .orderBy(asc(nextActions.dueAt)),
    ]);

    const eventsByApplication = groupByApplicationId(eventRows);
    const snapshotsByApplication = groupByApplicationId(snapshotRows);
    const documentsByApplication = groupByApplicationId(documentUseRows);
    const contactsByApplication = groupByApplicationId(contactRows);
    const notesByApplication = groupByApplicationId(noteRows);
    const actionsByApplication = groupByApplicationId(actionRows);

    return applicationRows.map((applicationRow) => {
      const snapshotRow = snapshotsByApplication.get(applicationRow.id)?.[0];
      if (!snapshotRow) {
        throw new Error(`Application ${applicationRow.publicId} has no job-description snapshot.`);
      }

      const timeline: TimelineEvent[] = (eventsByApplication.get(applicationRow.id) ?? []).map(
        (event) => ({
          id: event.id,
          kind: eventKind(event.eventKind),
          title: event.title,
          occurredAt: iso(event.occurredAt),
          ...(event.details ? { details: event.details } : {}),
          source: eventSource(event.source),
        }),
      );

      const snapshot: JobSnapshot = {
        capturedAt: iso(snapshotRow.capturedAt),
        sourceUrl: snapshotRow.sourceUrl ?? applicationRow.sourceUrl ?? '',
        provenance: snapshotRow.provenance,
        extractorVersion: snapshotRow.extractorVersion,
        contentHash: `sha256:${snapshotRow.contentSha256}`,
        html: snapshotRow.descriptionHtml,
        text: snapshotRow.descriptionText,
      };

      const applicationDocuments: DocumentVersion[] = (
        documentsByApplication.get(applicationRow.id) ?? []
      ).map((document) => ({
        kind: documentKind(document.kind),
        label: document.title,
        filename: document.filename ?? 'Metadata only',
        version: document.versionLabel,
        ...(document.usedAt ? { usedAt: iso(document.usedAt) } : {}),
      }));

      const applicationContactsList: Contact[] = (
        contactsByApplication.get(applicationRow.id) ?? []
      ).map((contact) => ({
        id: contact.contactId,
        name: contact.displayName,
        relationship: contact.relationship,
        ...(contact.email ? { email: contact.email } : {}),
      }));

      const applicationNotes: ApplicationNote[] = (
        notesByApplication.get(applicationRow.id) ?? []
      ).map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: iso(note.createdAt),
      }));

      const actionRow = actionsByApplication.get(applicationRow.id)?.[0];
      const nextAction: NextAction | undefined = actionRow
        ? {
            id: actionRow.id,
            kind: actionKind(actionRow.kind),
            title: actionRow.title,
            dueAt: iso(actionRow.dueAt),
            ...(actionRow.details ? { details: actionRow.details } : {}),
          }
        : undefined;

      return {
        id: applicationRow.publicId,
        company: applicationRow.companyName,
        role: applicationRow.roleTitle,
        location: applicationRow.locationText,
        workplace:
          applicationRow.workplace === 'on_site'
            ? 'On-site'
            : applicationRow.workplace === 'hybrid'
              ? 'Hybrid'
              : 'Remote',
        stage: applicationRow.currentStage,
        ...(applicationRow.projectedAppliedAt
          ? { dateApplied: iso(applicationRow.projectedAppliedAt) }
          : {}),
        updatedAt: iso(applicationRow.updatedAt),
        waitingOn: applicationRow.waitingOn,
        sourceUrl: applicationRow.sourceUrl ?? '',
        requisitionId: applicationRow.requisitionId ?? '',
        ...(nextAction ? { nextAction } : {}),
        timeline,
        snapshot,
        documents: applicationDocuments,
        contacts: applicationContactsList,
        notes: applicationNotes,
      } satisfies Application;
    });
  }

  return {
    listApplications,
    async getApplicationById(id) {
      const allApplications = await listApplications();
      return allApplications.find((application) => application.id === id);
    },
    getReferenceDate() {
      return new Date();
    },
  };
}
