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
import { extensionCaptureCommandSchema } from '@wip/schemas';

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
    const command = await readJson(request, extensionCaptureCommandSchema, 512_000);
    const service = await createExtensionCaptureServiceForRequest();
    const result = await service.capture(command, idempotencyKey);
    return withExtensionCors(
      apiData(result, {
        status: result.status === 'created' && !result.idempotentReplay ? 201 : 200,
        headers: { location: result.application.path },
      }),
      origin,
    );
  } catch (error) {
    const response = apiError(error);
    return origin ? withExtensionCors(response, origin) : response;
  }
}
