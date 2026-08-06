import { apiError } from '@/api/route-utils';
import { createTrackerDataServiceForRequest } from '@/services/command-service-factory';
import { TrackerError } from '@/services/tracker-errors';
import { trackerExportFormatSchema } from '@wip/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin') {
      throw new TrackerError('authentication_required', 'Cross-site exports are not allowed.', 403);
    }
    const parsed = trackerExportFormatSchema.safeParse(
      new URL(request.url).searchParams.get('format') ?? 'json',
    );
    if (!parsed.success) {
      throw new TrackerError('validation_error', 'Choose JSON or CSV export.', 400, {
        format: ['Use json or csv.'],
      });
    }
    const service = await createTrackerDataServiceForRequest();
    if (parsed.data === 'csv') {
      return new Response(await service.exportApplicationsCsv(), {
        headers: {
          'cache-control': 'private, no-store',
          'content-disposition': 'attachment; filename="wip-applications.csv"',
          'content-type': 'text/csv; charset=utf-8',
        },
      });
    }
    return new Response(JSON.stringify(await service.exportJson(), null, 2), {
      headers: {
        'cache-control': 'private, no-store',
        'content-disposition': 'attachment; filename="wip-tracker-export-v1.json"',
        'content-type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
