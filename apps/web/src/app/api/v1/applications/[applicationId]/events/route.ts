import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  readJson,
  requireIdempotencyKey,
} from '@/api/route-utils';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { recordStageChangeCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const applicationId = parseApplicationId((await params).applicationId);
    const command = await readJson(request, recordStageChangeCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.recordStageChange(applicationId, command, idempotencyKey), {
      status: 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
