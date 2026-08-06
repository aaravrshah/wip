import {
  extensionCaptureCommandSchema,
  extensionCaptureResponseSchema,
  type ExtensionCaptureCommand,
  type ExtensionCaptureResponse,
} from '@wip/schemas';

export class CaptureApiError extends Error {
  constructor(
    message: string,
    readonly code = 'capture_failed',
  ) {
    super(message);
    this.name = 'CaptureApiError';
  }
}

export async function saveCapture({
  apiOrigin,
  command,
  idempotencyKey,
  token,
}: {
  apiOrigin: string;
  command: ExtensionCaptureCommand;
  idempotencyKey: string;
  token: string;
}): Promise<ExtensionCaptureResponse> {
  const validated = extensionCaptureCommandSchema.parse(command);
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}/api/v1/captures`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(validated),
    });
  } catch {
    throw new CaptureApiError('Wip could not be reached. Your reviewed capture is still here.');
  }

  const payload = (await response.json().catch(() => undefined)) as
    { data?: unknown; error?: { code?: string; message?: string } } | undefined;
  if (!response.ok) {
    throw new CaptureApiError(
      payload?.error?.message ?? 'Wip could not save this capture. Try again.',
      payload?.error?.code,
    );
  }
  const parsed = extensionCaptureResponseSchema.safeParse(payload?.data);
  if (!parsed.success) {
    throw new CaptureApiError('Wip returned an unexpected capture response. Your draft is intact.');
  }
  return parsed.data;
}
