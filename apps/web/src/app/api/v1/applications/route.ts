import { createApplicationRepositoryForApiRequest } from '@/data';
import {
  apiData,
  apiError,
  assertSameOrigin,
  readJson,
  requireIdempotencyKey,
} from '@/api/route-utils';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { createApplicationCommandSchema } from '@wip/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repository = await createApplicationRepositoryForApiRequest();
    return apiData(await repository.listApplications());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const idempotencyKey = requireIdempotencyKey(request);
    const command = await readJson(request, createApplicationCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    const application = await service.createApplication(command, idempotencyKey);
    return apiData(application, {
      status: 201,
      headers: { location: `/api/v1/applications/${application.id}` },
    });
  } catch (error) {
    return apiError(error);
  }
}
