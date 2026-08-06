import {
  apiData,
  apiError,
  assertSameOrigin,
  parseApplicationId,
  parseResourceUuid,
  readJson,
} from '@/api/route-utils';
import { createApplicationCommandServiceForRequest } from '@/services/command-service-factory';
import { updateNoteCommandSchema } from '@wip/schemas';

interface RouteContext {
  params: Promise<{ applicationId: string; noteId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const noteId = parseResourceUuid(raw.noteId, 'noteId');
    const command = await readJson(request, updateNoteCommandSchema);
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.updateNote(applicationId, noteId, command));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request, false);
    const raw = await params;
    const applicationId = parseApplicationId(raw.applicationId);
    const noteId = parseResourceUuid(raw.noteId, 'noteId');
    const service = await createApplicationCommandServiceForRequest();
    return apiData(await service.deleteNote(applicationId, noteId));
  } catch (error) {
    return apiError(error);
  }
}
