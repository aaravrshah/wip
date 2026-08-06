import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  readJson,
} from '@/api/route-utils';
import { createApplicationRepositoryForApiRequest } from '@/data';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { notFoundError } from '@/services/tracker-errors';
import { deleteApplicationCommandSchema, updateApplicationCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string }>;
}

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const applicationId = parseApplicationId((await params).applicationId);
    const repository = await createApplicationRepositoryForApiRequest();
    const application = await repository.getApplicationById(applicationId);
    if (!application) throw notFoundError();
    return apiData(application);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const applicationId = parseApplicationId((await params).applicationId);
    const command = await readJson(request, updateApplicationCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.updateApplication(applicationId, command));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const applicationId = parseApplicationId((await params).applicationId);
    const command = await readJson(request, deleteApplicationCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    await service.deleteApplication(applicationId, command);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
