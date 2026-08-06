import { createHash } from 'node:crypto';

import type { Application, DocumentVersion, NextAction, TimelineEvent } from '@wip/domain';
import { demoApplications } from '@wip/fixtures';

import type { WipDatabase } from './client';
import {
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
  owners,
} from './schema';

export const DEMO_OWNER_ID = '00000000-0000-5000-8000-000000000001';

export function normalizeSha256(value: string): string {
  const normalized = value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(
      'Expected a SHA-256 value containing exactly 64 lowercase hexadecimal characters.',
    );
  }

  return normalized;
}

function stableUuid(key: string): string {
  const hex = createHash('sha256').update(`wip-fictional-seed:${key}`).digest('hex');
  const variant = (Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8;

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant.toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function toDate(value: string): Date {
  return new Date(value);
}

function toWorkplace(value: Application['workplace']): 'hybrid' | 'on_site' | 'remote' {
  if (value === 'On-site') return 'on_site';
  if (value === 'Hybrid') return 'hybrid';
  return 'remote';
}

function toEventKind(
  kind: TimelineEvent['kind'],
):
  | 'application'
  | 'assessment'
  | 'document'
  | 'employer'
  | 'follow_up'
  | 'interview'
  | 'offer'
  | 'status' {
  return kind === 'follow-up' ? 'follow_up' : kind;
}

function toContactRelationship(relationship: string) {
  const normalized = relationship.toLocaleLowerCase();
  if (normalized.includes('recruit')) return 'recruiter' as const;
  if (normalized.includes('referr')) return 'referrer' as const;
  if (normalized.includes('interview')) return 'interviewer' as const;
  if (normalized.includes('hiring')) return 'hiring_manager' as const;
  return 'other' as const;
}

function eventType(event: TimelineEvent): string {
  const normalizedTitle = event.title.toLowerCase();

  if (normalizedTitle.includes('withdrawn')) return 'application.withdrawn';
  if (normalizedTitle.includes('rejected') || normalizedTitle.includes('declined')) {
    return 'application.rejected';
  }
  if (normalizedTitle.includes('offer accepted')) return 'offer.accepted';
  if (normalizedTitle.includes('offer')) return 'offer.received';
  if (normalizedTitle.includes('submitted')) return 'application.submitted';
  if (event.kind === 'assessment') return 'assessment.updated';
  if (event.kind === 'interview') return 'interview.updated';
  if (event.kind === 'document') return 'document.prepared';
  if (event.kind === 'follow-up') return 'follow_up.sent';
  if (event.kind === 'employer') return 'employer.contact_received';
  if (event.kind === 'status') return 'application.status_changed';
  return 'application.created';
}

function toDocumentKind(
  kind: DocumentVersion['kind'],
): 'resume' | 'cover_letter' | 'portfolio' | 'other' {
  const values = {
    'Cover letter': 'cover_letter',
    Other: 'other',
    Portfolio: 'portfolio',
    Resume: 'resume',
  } as const;
  return values[kind];
}

function toActionKind(
  kind: NextAction['kind'],
): 'assessment' | 'decision' | 'follow_up' | 'interview' | 'prepare' | 'other' {
  return kind === 'follow-up' ? 'follow_up' : kind;
}

export async function seedDemoData(
  database: WipDatabase,
  ownerId: string = DEMO_OWNER_ID,
): Promise<void> {
  await database
    .insert(owners)
    .values({
      id: ownerId,
      timezone: 'America/New_York',
      locale: 'en-US',
    })
    .onConflictDoNothing();

  for (const application of demoApplications) {
    const applicationId = stableUuid(`application:${application.id}`);
    const firstEventAt = application.timeline.at(0)?.occurredAt ?? application.updatedAt;

    await database
      .insert(applications)
      .values({
        id: applicationId,
        ownerId,
        publicId: application.id,
        companyName: application.company,
        roleTitle: application.role,
        locationText: application.location,
        workplace: toWorkplace(application.workplace),
        currentStage: application.stage,
        projectedAppliedAt: application.dateApplied ? toDate(application.dateApplied) : null,
        lastConfirmedEventAt: toDate(application.updatedAt),
        waitingOn: application.waitingOn,
        sourceUrl: application.sourceUrl,
        requisitionId: application.requisitionId,
        createdAt: toDate(firstEventAt),
        updatedAt: toDate(application.updatedAt),
      })
      .onConflictDoNothing();

    await database
      .insert(applicationEvents)
      .values(
        application.timeline.map((event) => ({
          id: stableUuid(`event:${application.id}:${event.id}`),
          ownerId,
          applicationId,
          eventType: eventType(event),
          eventKind: toEventKind(event.kind),
          title: event.title,
          details: event.details,
          occurredAt: toDate(event.occurredAt),
          source: 'demo_seed' as const,
          confidence: null,
          confirmationState: 'not_required' as const,
          payloadVersion: 1,
          payload: {},
          createdByOwnerId: ownerId,
          createdAt: toDate(event.occurredAt),
        })),
      )
      .onConflictDoNothing();

    const snapshot = application.snapshot;
    if (!snapshot)
      throw new Error(`Fictional seed application ${application.id} needs a snapshot.`);

    await database
      .insert(jobDescriptionSnapshots)
      .values({
        id: stableUuid(`snapshot:${application.id}`),
        ownerId,
        applicationId,
        capturedAt: toDate(snapshot.capturedAt),
        captureSource: 'demo_seed',
        sourceUrl: snapshot.sourceUrl,
        descriptionHtml: snapshot.html,
        descriptionText: snapshot.text,
        contentSha256: normalizeSha256(snapshot.contentHash),
        extractorVersion: snapshot.extractorVersion,
        provenance: snapshot.provenance,
        captureMetadata: { fixture: true },
        createdAt: toDate(snapshot.capturedAt),
      })
      .onConflictDoNothing();

    for (const [documentIndex, document] of application.documents.entries()) {
      const documentId = stableUuid(`document:${application.id}:${documentIndex}`);
      const versionId = stableUuid(`document-version:${application.id}:${documentIndex}`);
      const createdAt = toDate(document.usedAt ?? application.updatedAt);

      await database
        .insert(documents)
        .values({
          id: documentId,
          ownerId,
          kind: toDocumentKind(document.kind),
          title: document.label,
          createdAt,
          updatedAt: createdAt,
        })
        .onConflictDoNothing();

      await database
        .insert(documentVersions)
        .values({
          id: versionId,
          ownerId,
          documentId,
          versionLabel: document.version,
          filename: document.filename,
          createdAt,
        })
        .onConflictDoNothing();

      await database
        .insert(applicationDocumentUses)
        .values({
          id: stableUuid(`document-use:${application.id}:${documentIndex}`),
          ownerId,
          applicationId,
          documentVersionId: versionId,
          purpose: document.usedAt ? 'submitted' : 'prepared',
          usedAt: document.usedAt ? toDate(document.usedAt) : null,
          createdAt,
        })
        .onConflictDoNothing();
    }

    for (const [contactIndex, contact] of application.contacts.entries()) {
      const contactId = stableUuid(`contact:${application.id}:${contactIndex}:${contact.id}`);

      await database
        .insert(contacts)
        .values({
          id: contactId,
          ownerId,
          displayName: contact.name,
          email: contact.email,
          organization: application.company,
          createdAt: toDate(application.updatedAt),
          updatedAt: toDate(application.updatedAt),
        })
        .onConflictDoNothing();

      await database
        .insert(applicationContacts)
        .values({
          id: stableUuid(`application-contact:${application.id}:${contactIndex}:${contact.id}`),
          ownerId,
          applicationId,
          contactId,
          relationship: toContactRelationship(contact.relationship),
          createdAt: toDate(application.updatedAt),
        })
        .onConflictDoNothing();
    }

    if (application.notes.length > 0) {
      await database
        .insert(notes)
        .values(
          application.notes.map((note) => ({
            id: stableUuid(`note:${application.id}:${note.id}`),
            ownerId,
            applicationId,
            body: note.body,
            createdAt: toDate(note.createdAt),
            updatedAt: toDate(note.createdAt),
          })),
        )
        .onConflictDoNothing();
    }

    if (application.nextAction) {
      await database
        .insert(nextActions)
        .values({
          id: stableUuid(`next-action:${application.id}:${application.nextAction.id}`),
          ownerId,
          applicationId,
          kind: toActionKind(application.nextAction.kind),
          title: application.nextAction.title,
          details: application.nextAction.details,
          dueAt: toDate(application.nextAction.dueAt),
          state: 'open',
          createdAt: toDate(application.updatedAt),
          updatedAt: toDate(application.updatedAt),
        })
        .onConflictDoNothing();
    }
  }
}
