import 'server-only';

import { createAuthenticatedDatabase } from '@wip/database';

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

async function authenticatedCommandContext() {
  const environment = getServerEnvironment();
  if (environment.dataSource !== 'neon') {
    throw new Error('Authenticated command context is unavailable in demo mode.');
  }
  const identity = await requireApiDatabaseIdentity();
  const database = createAuthenticatedDatabase(
    environment.authenticatedDatabaseUrl,
    identity.databaseToken,
  );
  const ownerId = await provisionAuthenticatedOwner(database);
  return { database, ownerId };
}

export async function createApplicationCommandServiceForRequest(): Promise<ApplicationCommandService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyCommandService();

  const { database, ownerId } = await authenticatedCommandContext();
  return new NeonApplicationCommandService(database, ownerId);
}

export async function createMetadataCommandServiceForRequest(): Promise<MetadataCommandService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyMetadataCommandService();

  const { database, ownerId } = await authenticatedCommandContext();
  return new NeonMetadataCommandService(database, ownerId);
}

export async function createTrackerDataServiceForRequest(): Promise<TrackerDataService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyTrackerDataService();

  const { database, ownerId } = await authenticatedCommandContext();
  return new NeonTrackerDataService(database, ownerId);
}

export async function createExtensionCaptureServiceForRequest(): Promise<ExtensionCaptureService> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return new DemoReadOnlyExtensionCaptureService();

  const { database, ownerId } = await authenticatedCommandContext();
  return new NeonExtensionCaptureService(database, ownerId);
}
