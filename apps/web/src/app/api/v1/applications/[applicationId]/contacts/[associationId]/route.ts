import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  parseResourceUuid,
  readJson,
} from '@/api/route-utils';
import { createMetadataCommandServiceForRequest } from '@/services/command-service-factory';
import { updateApplicationContactCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string; associationId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const associationId = parseResourceUuid(raw.associationId, 'associationId');
    const command = await readJson(request, updateApplicationContactCommandSchema);
    const service = await createMetadataCommandServiceForRequest();
    return apiData(await service.updateContact(applicationId, associationId, command));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request, false);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const associationId = parseResourceUuid(raw.associationId, 'associationId');
    const service = await createMetadataCommandServiceForRequest();
    return apiData(await service.deleteContact(applicationId, associationId));
  } catch (error) {
    return apiError(error);
  }
}
