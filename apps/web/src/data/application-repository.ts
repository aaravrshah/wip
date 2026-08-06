import type { Application, ContactRecord, DocumentRecord } from '@wip/domain';

export interface ApplicationRepository {
  listApplications(): Promise<Application[]>;
  getApplicationById(id: string): Promise<Application | undefined>;
  listContacts(): Promise<ContactRecord[]>;
  listDocuments(): Promise<DocumentRecord[]>;
  getTimeZone(): Promise<string>;
  getReferenceDate(): Date;
}
