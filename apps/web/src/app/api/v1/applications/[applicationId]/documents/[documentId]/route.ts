import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  parseResourceUuid,
  readJson,
} from '@/api/route-utils';
import { createMetadataCommandServiceForRequest } from '@/services/command-service-factory';
import { updateDocumentCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string; documentId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const documentId = parseResourceUuid(raw.documentId, 'documentId');
    const command = await readJson(request, updateDocumentCommandSchema);
    const service = await createMetadataCommandServiceForRequest();
    return apiData(await service.updateDocument(applicationId, documentId, command));
  } catch (error) {
    return apiError(error);
  }
}
