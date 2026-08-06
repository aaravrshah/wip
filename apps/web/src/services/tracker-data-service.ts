import 'server-only';

import {
  applicationContacts,
  applicationDocumentUses,
  applicationEvents,
  applications,
  contacts,
  documents,
  documentVersions,
  jobDescriptionSnapshots,
  nextActions,
  notes,
  owners,
  type WipDatabase,
} from '@wip/database';
import { TRACKER_DELETION_PHRASE, type DeleteTrackerDataCommand } from '@wip/schemas';
import { asc, eq, sql } from 'drizzle-orm';

import { TrackerError } from './tracker-errors';

export const TRACKER_EXPORT_FORMAT = 'wip.tracker.export';
export const TRACKER_EXPORT_VERSION = 1;

export interface TrackerDeletionResult {
  applicationsDeleted: number;
  documentsDeleted: number;
  contactsDeleted: number;
}

export interface TrackerDataService {
  exportJson(): Promise<Record<string, unknown>>;
  exportApplicationsCsv(): Promise<string>;
  deleteTrackerData(command: DeleteTrackerDataCommand): Promise<TrackerDeletionResult>;
}

function withoutOwner<T extends { ownerId: string }>(row: T): Omit<T, 'ownerId'> {
  const { ownerId: _ownerId, ...exported } = row;
  void _ownerId;
  return exported;
}

export function safeCsvCell(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  const spreadsheetSafe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

export class NeonTrackerDataService implements TrackerDataService {
  constructor(
    private readonly database: WipDatabase,
    private readonly ownerId: string,
  ) {}

  async exportJson(): Promise<Record<string, unknown>> {
    const [
      ownerRows,
      applicationRows,
      eventRows,
      snapshotRows,
      documentRows,
      versionRows,
      useRows,
      contactRows,
      contactLinkRows,
      noteRows,
      actionRows,
    ] = await this.database.batch([
      this.database
        .select({
          timezone: owners.timezone,
          locale: owners.locale,
          weekStartsOn: owners.weekStartsOn,
          createdAt: owners.createdAt,
          updatedAt: owners.updatedAt,
        })
        .from(owners)
        .where(eq(owners.id, this.ownerId)),
      this.database
        .select()
        .from(applications)
        .where(eq(applications.ownerId, this.ownerId))
        .orderBy(asc(applications.createdAt)),
      this.database
        .select()
        .from(applicationEvents)
        .where(eq(applicationEvents.ownerId, this.ownerId))
        .orderBy(asc(applicationEvents.occurredAt), asc(applicationEvents.createdAt)),
      this.database
        .select()
        .from(jobDescriptionSnapshots)
        .where(eq(jobDescriptionSnapshots.ownerId, this.ownerId))
        .orderBy(asc(jobDescriptionSnapshots.capturedAt)),
      this.database
        .select()
        .from(documents)
        .where(eq(documents.ownerId, this.ownerId))
        .orderBy(asc(documents.createdAt)),
      this.database
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.ownerId, this.ownerId))
        .orderBy(asc(documentVersions.createdAt)),
      this.database
        .select()
        .from(applicationDocumentUses)
        .where(eq(applicationDocumentUses.ownerId, this.ownerId))
        .orderBy(asc(applicationDocumentUses.createdAt)),
      this.database
        .select()
        .from(contacts)
        .where(eq(contacts.ownerId, this.ownerId))
        .orderBy(asc(contacts.createdAt)),
      this.database
        .select()
        .from(applicationContacts)
        .where(eq(applicationContacts.ownerId, this.ownerId))
        .orderBy(asc(applicationContacts.createdAt)),
      this.database
        .select()
        .from(notes)
        .where(eq(notes.ownerId, this.ownerId))
        .orderBy(asc(notes.createdAt)),
      this.database
        .select()
        .from(nextActions)
        .where(eq(nextActions.ownerId, this.ownerId))
        .orderBy(asc(nextActions.createdAt)),
    ]);

    return {
      format: TRACKER_EXPORT_FORMAT,
      formatVersion: TRACKER_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      accountSettings: ownerRows[0] ?? null,
      tracker: {
        applications: applicationRows.map(withoutOwner),
        applicationEvents: eventRows.map((row) => {
          const { createdByOwnerId: _createdByOwnerId, ...event } = withoutOwner(row);
          void _createdByOwnerId;
          return event;
        }),
        jobDescriptionSnapshots: snapshotRows.map(withoutOwner),
        documents: documentRows.map(withoutOwner),
        documentVersions: versionRows.map(withoutOwner),
        applicationDocumentUses: useRows.map(withoutOwner),
        contacts: contactRows.map(withoutOwner),
        applicationContacts: contactLinkRows.map(withoutOwner),
        notes: noteRows.map(withoutOwner),
        nextActions: actionRows.map(withoutOwner),
      },
    };
  }

  async exportApplicationsCsv(): Promise<string> {
    const rows = await this.database
      .select()
      .from(applications)
      .where(eq(applications.ownerId, this.ownerId))
      .orderBy(asc(applications.createdAt));
    const header = [
      'application_id',
      'company',
      'role',
      'location',
      'workplace',
      'stage',
      'date_applied',
      'last_confirmed_event_at',
      'waiting_on',
      'source_url',
      'source_name',
      'requisition_id',
      'created_at',
      'updated_at',
    ];
    const data = rows.map((row) => [
      row.publicId,
      row.companyName,
      row.roleTitle,
      row.locationText,
      row.workplace,
      row.currentStage,
      row.projectedAppliedAt,
      row.lastConfirmedEventAt,
      row.waitingOn,
      row.sourceUrl,
      row.sourceName,
      row.requisitionId,
      row.createdAt,
      row.updatedAt,
    ]);
    return [header, ...data].map((row) => row.map(safeCsvCell).join(',')).join('\r\n') + '\r\n';
  }

  async deleteTrackerData(command: DeleteTrackerDataCommand): Promise<TrackerDeletionResult> {
    if (command.confirmation !== TRACKER_DELETION_PHRASE) {
      throw new TrackerError(
        'validation_error',
        `Type ${TRACKER_DELETION_PHRASE} exactly to delete tracker data.`,
        400,
        { confirmation: ['The confirmation phrase does not match.'] },
      );
    }
    const result = await this.database.execute<{
      applicationsDeleted: string | number;
      documentsDeleted: string | number;
      contactsDeleted: string | number;
    }>(sql`
      select
        applications_deleted as "applicationsDeleted",
        documents_deleted as "documentsDeleted",
        contacts_deleted as "contactsDeleted"
      from public.wip_delete_tracker_data()
    `);
    const counts = result.rows[0];
    if (!counts) throw new Error('Tracker-data deletion returned no result.');
    return {
      applicationsDeleted: Number(counts.applicationsDeleted),
      documentsDeleted: Number(counts.documentsDeleted),
      contactsDeleted: Number(counts.contactsDeleted),
    };
  }
}

export class DemoReadOnlyTrackerDataService implements TrackerDataService {
  private reject(): never {
    throw new TrackerError(
      'demo_read_only',
      'The fictional demo cannot export or delete tracker data.',
      403,
    );
  }

  async exportJson(): Promise<Record<string, unknown>> {
    this.reject();
  }
  async exportApplicationsCsv(): Promise<string> {
    this.reject();
  }
  async deleteTrackerData(): Promise<TrackerDeletionResult> {
    this.reject();
  }
}
