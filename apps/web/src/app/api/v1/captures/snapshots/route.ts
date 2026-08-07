import {
  apiData,
  apiError,
  assertExtensionOrigin,
  assertJsonContentType,
  extensionPreflightResponse,
  readJson,
  requireBearerAuthorization,
  requireIdempotencyKey,
  withExtensionCors,
} from '@/api/route-utils';
import { getExtensionOrigins } from '@/env/server';
import { createExtensionCaptureServiceForRequest } from '@/services/command-service-factory';
import { extensionSnapshotAttachmentCommandSchema } from '@wip/schemas';

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  try {
    return extensionPreflightResponse(assertExtensionOrigin(request, getExtensionOrigins()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  let origin: string | undefined;
  try {
    origin = assertExtensionOrigin(request, getExtensionOrigins());
    requireBearerAuthorization(request);
    assertJsonContentType(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const command = await readJson(request, extensionSnapshotAttachmentCommandSchema, 512_000);
    const service = await createExtensionCaptureServiceForRequest(origin);
    const result = await service.attachSnapshot(command, idempotencyKey);
    return withExtensionCors(apiData(result, { status: result.created ? 201 : 200 }), origin);
  } catch (error) {
    const response = apiError(error);
    return origin ? withExtensionCors(response, origin) : response;
  }
}
