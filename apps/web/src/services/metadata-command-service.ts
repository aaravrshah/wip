import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  applicationContacts,
  applicationDocumentUses,
  applications,
  contacts,
  documents,
  documentVersions,
  type WipDatabase,
} from '@wip/database';
import type { Application } from '@wip/domain';
import type {
  CreateApplicationContactCommand,
  CreateApplicationDocumentCommand,
  UpdateApplicationContactCommand,
  UpdateDocumentCommand,
} from '@wip/schemas';
import { and, eq, sql } from 'drizzle-orm';

import { createOwnerScopedNeonApplicationRepository } from '@/data/neon-application-repository';

import { conflictError, notFoundError, TrackerError } from './tracker-errors';

export interface MetadataCommandService {
  createContact(
    applicationId: string,
    command: CreateApplicationContactCommand,
  ): Promise<Application>;
  updateContact(
    applicationId: string,
    associationId: string,
    command: UpdateApplicationContactCommand,
  ): Promise<Application>;
  deleteContact(applicationId: string, associationId: string): Promise<Application>;
  createDocument(
    applicationId: string,
    command: CreateApplicationDocumentCommand,
  ): Promise<Application>;
  updateDocument(
    applicationId: string,
    documentId: string,
    command: UpdateDocumentCommand,
  ): Promise<Application>;
  deleteDocumentUse(applicationId: string, useId: string): Promise<Application>;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

export class NeonMetadataCommandService implements MetadataCommandService {
  private readonly repository;

  constructor(
    private readonly database: WipDatabase,
    private readonly ownerId: string,
  ) {
    this.repository = createOwnerScopedNeonApplicationRepository(database, ownerId);
  }

  private async applicationRow(publicId: string) {
    const application = await this.database.query.applications.findFirst({
      where: and(eq(applications.ownerId, this.ownerId), eq(applications.publicId, publicId)),
    });
    if (!application) throw notFoundError();
    return application;
  }

  private async application(publicId: string): Promise<Application> {
    const application = await this.repository.getApplicationById(publicId);
    if (!application) throw notFoundError();
    return application;
  }

  async createContact(
    applicationId: string,
    command: CreateApplicationContactCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    const associationId = randomUUID();

    try {
      if (command.mode === 'link') {
        const contact = await this.database.query.contacts.findFirst({
          where: and(eq(contacts.ownerId, this.ownerId), eq(contacts.id, command.contactId)),
        });
        if (!contact) throw notFoundError();
        await this.database.insert(applicationContacts).values({
          id: associationId,
          ownerId: this.ownerId,
          applicationId: application.id,
          contactId: contact.id,
          relationship: command.relationship,
        });
      } else {
        const contactId = randomUUID();
        await this.database.batch([
          this.database.insert(contacts).values({
            id: contactId,
            ownerId: this.ownerId,
            displayName: command.name,
            organization: command.organization ?? null,
            roleTitle: command.roleTitle ?? null,
            email: command.email ?? null,
            phone: command.phone ?? null,
            profileUrl: command.profileUrl ?? null,
          }),
          this.database.insert(applicationContacts).values({
            id: associationId,
            ownerId: this.ownerId,
            applicationId: application.id,
            contactId,
            relationship: command.relationship,
          }),
        ]);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflictError('That contact is already linked to this application.');
      }
      throw error;
    }

    return this.application(applicationId);
  }

  async updateContact(
    applicationId: string,
    associationId: string,
    command: UpdateApplicationContactCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    const result = await this.database.execute<{ contactId: string }>(sql`
      with updated_contact as (
        update public.contacts as contact
        set
          display_name = ${command.name},
          organization = ${command.organization ?? null},
          role_title = ${command.roleTitle ?? null},
          email = ${command.email ?? null},
          phone = ${command.phone ?? null},
          profile_url = ${command.profileUrl ?? null},
          version = contact.version + 1,
          updated_at = now()
        where contact.owner_id = ${this.ownerId}::uuid
          and contact.version = ${command.expectedVersion}
          and exists (
            select 1 from public.application_contacts as link
            where link.owner_id = contact.owner_id
              and link.contact_id = contact.id
              and link.application_id = ${application.id}::uuid
              and link.id = ${associationId}::uuid
          )
        returning contact.id
      ), updated_link as (
        update public.application_contacts as link
        set relationship = ${command.relationship}::contact_relationship
        from updated_contact
        where link.owner_id = ${this.ownerId}::uuid
          and link.application_id = ${application.id}::uuid
          and link.id = ${associationId}::uuid
          and link.contact_id = updated_contact.id
        returning link.contact_id
      )
      select contact_id as "contactId" from updated_link
    `);

    if (result.rows.length === 0) {
      const existing = await this.database
        .select({ version: contacts.version })
        .from(applicationContacts)
        .innerJoin(
          contacts,
          and(
            eq(applicationContacts.ownerId, contacts.ownerId),
            eq(applicationContacts.contactId, contacts.id),
          ),
        )
        .where(
          and(
            eq(applicationContacts.ownerId, this.ownerId),
            eq(applicationContacts.applicationId, application.id),
            eq(applicationContacts.id, associationId),
          ),
        );
      if (existing.length > 0) {
        throw conflictError('This contact changed in another tab. Refresh and retry.');
      }
      throw notFoundError();
    }
    return this.application(applicationId);
  }

  async deleteContact(applicationId: string, associationId: string): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    const association = await this.database.query.applicationContacts.findFirst({
      where: and(
        eq(applicationContacts.ownerId, this.ownerId),
        eq(applicationContacts.applicationId, application.id),
        eq(applicationContacts.id, associationId),
      ),
    });
    if (!association) throw notFoundError();

    await this.database.batch([
      this.database
        .delete(applicationContacts)
        .where(
          and(
            eq(applicationContacts.ownerId, this.ownerId),
            eq(applicationContacts.applicationId, application.id),
            eq(applicationContacts.id, associationId),
          ),
        ),
      this.database.execute(sql`
        delete from public.contacts as contact
        where contact.owner_id = ${this.ownerId}::uuid
          and contact.id = ${association.contactId}::uuid
          and not exists (
            select 1 from public.application_contacts as link
            where link.owner_id = contact.owner_id and link.contact_id = contact.id
          )
      `),
    ]);
    return this.application(applicationId);
  }

  async createDocument(
    applicationId: string,
    command: CreateApplicationDocumentCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    const useId = randomUUID();

    try {
      if (command.mode === 'link_version') {
        const version = await this.database.query.documentVersions.findFirst({
          where: and(
            eq(documentVersions.ownerId, this.ownerId),
            eq(documentVersions.id, command.documentVersionId),
          ),
        });
        if (!version) throw notFoundError();
        await this.database.insert(applicationDocumentUses).values({
          id: useId,
          ownerId: this.ownerId,
          applicationId: application.id,
          documentVersionId: version.id,
          purpose: command.purpose,
          usedAt: command.usedAt ? new Date(command.usedAt) : null,
        });
      } else if (command.mode === 'add_version') {
        const document = await this.database.query.documents.findFirst({
          where: and(eq(documents.ownerId, this.ownerId), eq(documents.id, command.documentId)),
        });
        if (!document) throw notFoundError();
        const versionId = randomUUID();
        await this.database.batch([
          this.database.insert(documentVersions).values({
            id: versionId,
            ownerId: this.ownerId,
            documentId: document.id,
            versionLabel: command.versionLabel,
            filename: command.filename ?? null,
            contentSha256: command.contentSha256 ?? null,
            externalReference: command.externalReference ?? null,
          }),
          this.database.insert(applicationDocumentUses).values({
            id: useId,
            ownerId: this.ownerId,
            applicationId: application.id,
            documentVersionId: versionId,
            purpose: command.purpose,
            usedAt: command.usedAt ? new Date(command.usedAt) : null,
          }),
        ]);
      } else {
        const documentId = randomUUID();
        const versionId = randomUUID();
        await this.database.batch([
          this.database.insert(documents).values({
            id: documentId,
            ownerId: this.ownerId,
            kind: command.kind,
            title: command.title,
          }),
          this.database.insert(documentVersions).values({
            id: versionId,
            ownerId: this.ownerId,
            documentId,
            versionLabel: command.versionLabel,
            filename: command.filename ?? null,
            contentSha256: command.contentSha256 ?? null,
            externalReference: command.externalReference ?? null,
          }),
          this.database.insert(applicationDocumentUses).values({
            id: useId,
            ownerId: this.ownerId,
            applicationId: application.id,
            documentVersionId: versionId,
            purpose: command.purpose,
            usedAt: command.usedAt ? new Date(command.usedAt) : null,
          }),
        ]);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflictError('That document version or use already exists.');
      }
      throw error;
    }

    return this.application(applicationId);
  }

  async updateDocument(
    applicationId: string,
    documentId: string,
    command: UpdateDocumentCommand,
  ): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    const linked = await this.database
      .select({ id: documents.id })
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
      .where(
        and(
          eq(applicationDocumentUses.ownerId, this.ownerId),
          eq(applicationDocumentUses.applicationId, application.id),
          eq(documents.id, documentId),
        ),
      )
      .limit(1);
    if (linked.length === 0) throw notFoundError();

    const updated = await this.database
      .update(documents)
      .set({
        kind: command.kind,
        title: command.title,
        version: sql`${documents.version} + 1`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(documents.ownerId, this.ownerId),
          eq(documents.id, documentId),
          eq(documents.version, command.expectedVersion),
        ),
      )
      .returning({ id: documents.id });
    if (updated.length === 0) {
      throw conflictError('This document changed in another tab. Refresh and retry.');
    }
    return this.application(applicationId);
  }

  async deleteDocumentUse(applicationId: string, useId: string): Promise<Application> {
    const application = await this.applicationRow(applicationId);
    const removed = await this.database
      .delete(applicationDocumentUses)
      .where(
        and(
          eq(applicationDocumentUses.ownerId, this.ownerId),
          eq(applicationDocumentUses.applicationId, application.id),
          eq(applicationDocumentUses.id, useId),
        ),
      )
      .returning({ id: applicationDocumentUses.id });
    if (removed.length === 0) throw notFoundError();
    return this.application(applicationId);
  }
}

export class DemoReadOnlyMetadataCommandService implements MetadataCommandService {
  private reject(): never {
    throw new TrackerError(
      'demo_read_only',
      'The fictional demo is read-only. Switch to Clerk + Neon mode to save changes.',
      403,
    );
  }

  async createContact(): Promise<Application> {
    this.reject();
  }
  async updateContact(): Promise<Application> {
    this.reject();
  }
  async deleteContact(): Promise<Application> {
    this.reject();
  }
  async createDocument(): Promise<Application> {
    this.reject();
  }
  async updateDocument(): Promise<Application> {
    this.reject();
  }
  async deleteDocumentUse(): Promise<Application> {
    this.reject();
  }
}
