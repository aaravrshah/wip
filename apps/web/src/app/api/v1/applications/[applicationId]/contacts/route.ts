import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  readJson,
} from '@/api/route-utils';
import { createMetadataCommandServiceForRequest } from '@/services/command-service-factory';
import { createApplicationContactCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const applicationId = parseApplicationId((await params).applicationId);
    const command = await readJson(request, createApplicationContactCommandSchema);
    const service = await createMetadataCommandServiceForRequest();
    return apiData(await service.createContact(applicationId, command), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
