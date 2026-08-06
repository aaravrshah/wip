import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  readJson,
} from '@/api/route-utils';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { createNextActionCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const applicationId = parseApplicationId((await params).applicationId);
    const command = await readJson(request, createNextActionCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.createNextAction(applicationId, command), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
