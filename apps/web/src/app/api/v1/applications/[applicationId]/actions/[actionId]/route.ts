import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  parseResourceUuid,
  readJson,
} from '@/api/route-utils';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { updateNextActionCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string; actionId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const actionId = parseResourceUuid(raw.actionId, 'actionId');
    const command = await readJson(request, updateNextActionCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.updateNextAction(applicationId, actionId, command));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request, false);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const actionId = parseResourceUuid(raw.actionId, 'actionId');
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.deleteNextAction(applicationId, actionId));
  } catch (error) {
    return apiError(error);
  }
}
