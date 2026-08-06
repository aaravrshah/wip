import 'server-only';

import { withTenantDatabase, type WipDatabase } from '@wip/database';

import { requireApiDatabaseIdentity } from '@/auth/server';
import { provisionAuthenticatedOwner } from '@/data/neon-application-repository';
import { getServerEnvironment } from '@/env/server';

import {
  DemoReadOnlyCommandService,
  NeonApplicationCommandService,
  type ApplicationCommandService,
} from './application-command-service';
import {
  DemoReadOnlyMetadataCommandService,
  NeonMetadataCommandService,
  type MetadataCommandService,
} from './metadata-command-service';
import {
  DemoReadOnlyExtensionCaptureService,
  NeonExtensionCaptureService,
  type ExtensionCaptureService,
} from './extension-capture-service';
import {
  DemoReadOnlyTrackerDataService,
  NeonTrackerDataService,
  type TrackerDataService,
} from './tracker-data-service';

type AuthenticatedOperation = <T>(
  operation: (database: WipDatabase, ownerId: string) => Promise<T>,
) => Promise<T>;

async function createAuthenticatedOperation(): Promise<AuthenticatedOperation> {
  const environment = getServerEnvironment();
  if (environment.dataSource !== 'neon') {
    throw new Error('Authenticated command context is unavailable in demo mode.');
  }

  const identity = await requireApiDatabaseIdentity();
  return (operation) =>
    withTenantDatabase(environment.runtimeDatabaseUrl, identity.clerkUserId, async (database) => {
      const ownerId = await provisionAuthenticatedOwner(database);
      return operation(database, ownerId);
    });
}

export async function createApplicationCommandServiceForRequest(): Promise<ApplicationCommandService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyCommandService();

  const run = await createAuthenticatedOperation();
  return {
    createApplication: (command, idempotencyKey, options) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).createApplication(
          command,
          idempotencyKey,
          options,
        ),
      ),
    updateApplication: (applicationId, command) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).updateApplication(
          applicationId,
          command,
        ),
      ),
    recordStageChange: (applicationId, command, idempotencyKey) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).recordStageChange(
          applicationId,
          command,
          idempotencyKey,
        ),
      ),
    createNote: (applicationId, command) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).createNote(applicationId, command),
      ),
    updateNote: (applicationId, noteId, command) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).updateNote(
          applicationId,
          noteId,
          command,
        ),
      ),
    deleteNote: (applicationId, noteId) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).deleteNote(applicationId, noteId),
      ),
    createNextAction: (applicationId, command) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).createNextAction(
          applicationId,
          command,
        ),
      ),
    updateNextAction: (applicationId, actionId, command) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).updateNextAction(
          applicationId,
          actionId,
          command,
        ),
      ),
    deleteNextAction: (applicationId, actionId) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).deleteNextAction(
          applicationId,
          actionId,
        ),
      ),
    deleteApplication: (applicationId, command) =>
      run((database, ownerId) =>
        new NeonApplicationCommandService(database, ownerId).deleteApplication(
          applicationId,
          command,
        ),
      ),
  };
}

export async function createMetadataCommandServiceForRequest(): Promise<MetadataCommandService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyMetadataCommandService();

  const run = await createAuthenticatedOperation();
  return {
    createContact: (applicationId, command) =>
      run((database, ownerId) =>
        new NeonMetadataCommandService(database, ownerId).createContact(applicationId, command),
      ),
    updateContact: (applicationId, associationId, command) =>
      run((database, ownerId) =>
        new NeonMetadataCommandService(database, ownerId).updateContact(
          applicationId,
          associationId,
          command,
        ),
      ),
    deleteContact: (applicationId, associationId) =>
      run((database, ownerId) =>
        new NeonMetadataCommandService(database, ownerId).deleteContact(
          applicationId,
          associationId,
        ),
      ),
    createDocument: (applicationId, command) =>
      run((database, ownerId) =>
        new NeonMetadataCommandService(database, ownerId).createDocument(applicationId, command),
      ),
    updateDocument: (applicationId, documentId, command) =>
      run((database, ownerId) =>
        new NeonMetadataCommandService(database, ownerId).updateDocument(
          applicationId,
          documentId,
          command,
        ),
      ),
    deleteDocumentUse: (applicationId, useId) =>
      run((database, ownerId) =>
        new NeonMetadataCommandService(database, ownerId).deleteDocumentUse(applicationId, useId),
      ),
  };
}

export async function createTrackerDataServiceForRequest(): Promise<TrackerDataService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyTrackerDataService();

  const run = await createAuthenticatedOperation();
  return {
    exportJson: () =>
      run((database, ownerId) => new NeonTrackerDataService(database, ownerId).exportJson()),
    exportApplicationsCsv: () =>
      run((database, ownerId) =>
        new NeonTrackerDataService(database, ownerId).exportApplicationsCsv(),
      ),
    deleteTrackerData: (command) =>
      run((database, ownerId) =>
        new NeonTrackerDataService(database, ownerId).deleteTrackerData(command),
      ),
  };
}

export async function createExtensionCaptureServiceForRequest(): Promise<ExtensionCaptureService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyExtensionCaptureService();

  const run = await createAuthenticatedOperation();
  return {
    capture: (command, idempotencyKey) =>
      run((database, ownerId) =>
        new NeonExtensionCaptureService(database, ownerId).capture(command, idempotencyKey),
      ),
  };
}
