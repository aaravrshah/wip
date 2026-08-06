import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  readJson,
} from '@/api/route-utils';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { createNoteCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const applicationId = parseApplicationId((await params).applicationId);
    const command = await readJson(request, createNoteCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.createNote(applicationId, command), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
