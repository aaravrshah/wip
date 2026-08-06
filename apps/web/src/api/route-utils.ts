import { AuthenticationRequiredError } from '@/auth/server';
import { TrackerError } from '@/services/tracker-errors';
import { idempotencyKeySchema } from '@wip/schemas';
import { z } from 'zod';

const DEFAULT_MAX_JSON_BYTES = 256_000;
const applicationIdentifierSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);
const uuidIdentifierSchema = z.uuid();

function parsePathIdentifier(value: string, field: string, schema: z.ZodType<string>): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new TrackerError('validation_error', `The ${field} is invalid.`, 400, {
      [field]: ['Use a valid identifier.'],
    });
  }
  return parsed.data;
}

export function parseApplicationId(value: string): string {
  return parsePathIdentifier(value, 'applicationId', applicationIdentifierSchema);
}

export function parseResourceUuid(
  value: string,
  field: 'actionId' | 'associationId' | 'documentId' | 'noteId' | 'useId',
): string {
  return parsePathIdentifier(value, field, uuidIdentifierSchema);
}

export function assertSameOrigin(request: Request, requireJson = true): void {
  const origin = request.headers.get('origin');
  const expectedOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get('sec-fetch-site');

  if (!origin || origin !== expectedOrigin || (fetchSite && fetchSite !== 'same-origin')) {
    throw new TrackerError(
      'authentication_required',
      'Cross-origin mutation requests are not allowed.',
      403,
    );
  }

  if (requireJson) {
    assertJsonContentType(request);
  }
}

export function assertJsonContentType(request: Request): void {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new TrackerError(
      'unsupported_media_type',
      'Use Content-Type: application/json for this request.',
      415,
    );
  }
}

export function requireIdempotencyKey(request: Request): string {
  const parsed = idempotencyKeySchema.safeParse(request.headers.get('idempotency-key'));
  if (!parsed.success) {
    throw new TrackerError('validation_error', 'A valid Idempotency-Key header is required.', 400, {
      idempotencyKey: parsed.error.issues.map((issue) => issue.message),
    });
  }
  return parsed.data;
}

async function boundedBody(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new TrackerError('payload_too_large', 'The request body is too large.', 413);
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new TrackerError('payload_too_large', 'The request body is too large.', 413);
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maximumBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<T> {
  const raw = await boundedBody(request, maximumBytes);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TrackerError('validation_error', 'The request body must contain valid JSON.', 400);
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    throw new TrackerError(
      'validation_error',
      'Check the highlighted fields and try again.',
      400,
      Object.fromEntries(
        Object.entries(flattened.fieldErrors).filter((entry): entry is [string, string[]] =>
          Boolean(entry[1]),
        ),
      ),
    );
  }
  return parsed.data;
}

export function requireBearerAuthorization(request: Request): void {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new AuthenticationRequiredError('A Clerk session Bearer token is required.');
  }
}

export function assertExtensionOrigin(request: Request, allowedOrigins: readonly string[]): string {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins.includes(origin)) {
    throw new TrackerError(
      'authentication_required',
      'This extension origin is not allowed to use Wip capture.',
      403,
    );
  }
  return origin;
}

export function withExtensionCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', 'Origin');
  headers.set('cache-control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function extensionPreflightResponse(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type, Idempotency-Key',
      'access-control-max-age': '600',
      'cache-control': 'no-store',
      vary: 'Origin',
    },
  });
}

export function apiData(data: unknown, init?: ResponseInit): Response {
  return Response.json({ data }, init);
}

export function apiError(error: unknown): Response {
  if (error instanceof TrackerError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      { status: error.status },
    );
  }
  if (error instanceof AuthenticationRequiredError) {
    return Response.json(
      { error: { code: 'authentication_required', message: error.message } },
      { status: 401 },
    );
  }

  return Response.json(
    { error: { code: 'internal_error', message: 'Wip could not complete that request.' } },
    { status: 500 },
  );
}
