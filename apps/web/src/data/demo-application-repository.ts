import type { Application, ContactRecord, DocumentRecord } from '@wip/domain';

import type { ApplicationRepository } from './application-repository';
import { demoApplications, demoReferenceDate } from '@wip/fixtures';

function cloneApplication(application: Application): Application {
  return structuredClone(application);
}

function demoContacts(): ContactRecord[] {
  const contacts = new Map<string, ContactRecord>();
  for (const application of demoApplications) {
    for (const contact of application.contacts) {
      contacts.set(contact.id, {
        id: contact.id,
        name: contact.name,
        ...(contact.email ? { email: contact.email } : {}),
        version: 1,
      });
    }
  }
  return [...contacts.values()];
}

function demoDocuments(): DocumentRecord[] {
  return demoApplications.flatMap((application) =>
    application.documents.map((document, index) => ({
      id: `demo-document-${application.id}-${index}`,
      kind: document.kind,
      label: document.label,
      version: 1,
      versions: [
        {
          id: `demo-version-${application.id}-${index}`,
          version: document.version,
          filename: document.filename,
          createdAt: document.usedAt ?? application.updatedAt,
        },
      ],
    })),
  );
}

export const demoApplicationRepository: ApplicationRepository = {
  async listApplications() {
    return demoApplications.map(cloneApplication);
  },

  async getApplicationById(id) {
    const application = demoApplications.find((candidate) => candidate.id === id);
    return application ? cloneApplication(application) : undefined;
  },

  async listContacts() {
    return structuredClone(demoContacts());
  },

  async listDocuments() {
    return structuredClone(demoDocuments());
  },

  async getTimeZone() {
    return 'America/New_York';
  },

  getReferenceDate() {
    return new Date(demoReferenceDate);
  },
};
