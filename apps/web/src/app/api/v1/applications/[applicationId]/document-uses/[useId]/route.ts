import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  parseResourceUuid,
} from '@/api/route-utils';
import { createMetadataCommandServiceForRequest } from '@/services/command-service-factory';

interface RouteContext {
  params: Promise<{ applicationId: string; useId: string }>;
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request, false);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const useId = parseResourceUuid(raw.useId, 'useId');
    const service = await createMetadataCommandServiceForRequest();
    return apiData(await service.deleteDocumentUse(applicationId, useId));
  } catch (error) {
    return apiError(error);
  }
}
