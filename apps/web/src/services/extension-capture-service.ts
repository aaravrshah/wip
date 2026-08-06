import 'server-only';

import { applications, jobDescriptionSnapshots, type WipDatabase } from '@wip/database';
import type { Application } from '@wip/domain';
import type {
  CreateApplicationCommand,
  ExtensionCaptureCommand,
  ExtensionCaptureResponse,
} from '@wip/schemas';
import { and, eq } from 'drizzle-orm';

import { createOwnerScopedNeonApplicationRepository } from '@/data/neon-application-repository';

import { NeonApplicationCommandService } from './application-command-service';
import { normalizeCaptureUrl, prepareExtensionCapture } from './capture-normalization';
import { TrackerError } from './tracker-errors';

export interface ExtensionCaptureService {
  capture(
    command: ExtensionCaptureCommand,
    idempotencyKey: string,
  ): Promise<ExtensionCaptureResponse>;
}

function applicationSummary(application: Application) {
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    stage: application.stage,
    path: `/applications/${application.id}`,
  } as const;
}

function normalizedCompany(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

function safeNormalizeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return normalizeCaptureUrl(value);
  } catch {
    return undefined;
  }
}

export class NeonExtensionCaptureService implements ExtensionCaptureService {
  private readonly repository;
  private readonly applicationCommands;

  constructor(
    private readonly database: WipDatabase,
    private readonly ownerId: string,
  ) {
    this.repository = createOwnerScopedNeonApplicationRepository(database, ownerId);
    this.applicationCommands = new NeonApplicationCommandService(database, ownerId);
  }

  private async applicationOrThrow(publicId: string): Promise<Application> {
    const application = await this.repository.getApplicationById(publicId);
    if (!application) {
      throw new Error('A capture application row was not readable after persistence.');
    }
    return application;
  }

  async capture(
    command: ExtensionCaptureCommand,
    idempotencyKey: string,
  ): Promise<ExtensionCaptureResponse> {
    const prepared = prepareExtensionCapture(command);
    const createCommand: CreateApplicationCommand = {
      company: command.company,
      role: command.role,
      stage: command.stage,
      sourceUrl: prepared.applicationSourceUrl,
      sourceName: new URL(prepared.applicationSourceUrl).hostname,
      location: command.location,
      workplace: command.workplace,
      requisitionId: command.requisitionId,
      jobDescriptionText: undefined,
    };
    const createOptions = {
      eventSource: 'extension' as const,
      extensionSnapshot: prepared.snapshot,
      idempotencyPayload: command,
    };

    const replay = await this.database.query.applications.findFirst({
      where: and(
        eq(applications.ownerId, this.ownerId),
        eq(applications.createIdempotencyKey, idempotencyKey),
      ),
    });
    if (replay) {
      const application = await this.applicationCommands.createApplication(
        createCommand,
        idempotencyKey,
        createOptions,
      );
      return {
        status: 'created',
        application: applicationSummary(application),
        idempotentReplay: true,
      };
    }

    const candidates = await this.database
      .select({
        publicId: applications.publicId,
        companyName: applications.companyName,
        sourceUrl: applications.sourceUrl,
        requisitionId: applications.requisitionId,
        snapshotSourceUrl: jobDescriptionSnapshots.sourceUrl,
        canonicalUrl: jobDescriptionSnapshots.canonicalUrl,
      })
      .from(applications)
      .leftJoin(
        jobDescriptionSnapshots,
        and(
          eq(applications.ownerId, jobDescriptionSnapshots.ownerId),
          eq(applications.id, jobDescriptionSnapshots.applicationId),
        ),
      )
      .where(eq(applications.ownerId, this.ownerId));

    const targetUrls = new Set(
      [
        prepared.applicationSourceUrl,
        prepared.snapshot.sourceUrl,
        prepared.snapshot.canonicalUrl,
      ].filter((value): value is string => Boolean(value)),
    );
    const targetRequisition = command.requisitionId?.trim().toLocaleLowerCase('en');
    for (const candidate of candidates) {
      const matchedOn: Array<'source_url' | 'requisition_id'> = [];
      const candidateUrls = [
        candidate.sourceUrl,
        candidate.snapshotSourceUrl,
        candidate.canonicalUrl,
      ]
        .map(safeNormalizeUrl)
        .filter((value): value is string => Boolean(value));
      if (candidateUrls.some((value) => targetUrls.has(value))) matchedOn.push('source_url');
      if (
        targetRequisition &&
        candidate.requisitionId?.trim().toLocaleLowerCase('en') === targetRequisition &&
        normalizedCompany(candidate.companyName) === normalizedCompany(command.company)
      ) {
        matchedOn.push('requisition_id');
      }
      if (matchedOn.length > 0) {
        const application = await this.applicationOrThrow(candidate.publicId);
        return { status: 'duplicate', application: applicationSummary(application), matchedOn };
      }
    }

    const application = await this.applicationCommands.createApplication(
      createCommand,
      idempotencyKey,
      createOptions,
    );
    return {
      status: 'created',
      application: applicationSummary(application),
      idempotentReplay: false,
    };
  }
}

export class DemoReadOnlyExtensionCaptureService implements ExtensionCaptureService {
  async capture(): Promise<ExtensionCaptureResponse> {
    throw new TrackerError(
      'demo_read_only',
      'The fictional demo is read-only. Configure Clerk and Neon to save a capture.',
      403,
    );
  }
}
