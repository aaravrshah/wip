import { apiData, apiError, assertSameOrigin, readJson } from '@/api/route-utils';
import { createTrackerDataServiceForRequest } from '@/services/command-service-factory';
import { deleteTrackerDataCommandSchema } from '@wip/schemas';

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const command = await readJson(request, deleteTrackerDataCommandSchema);
    const service = await createTrackerDataServiceForRequest();
    return apiData(await service.deleteTrackerData(command));
  } catch (error) {
    return apiError(error);
  }
}
