import {
  extensionCaptureCommandSchema,
  extensionCaptureResponseSchema,
  extensionSnapshotAttachmentCommandSchema,
  extensionSnapshotAttachmentResponseSchema,
  type ExtensionCaptureCommand,
  type ExtensionCaptureResponse,
  type ExtensionSnapshotAttachmentCommand,
  type ExtensionSnapshotAttachmentResponse,
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

async function captureRequest<Result>({
  apiOrigin,
  body,
  idempotencyKey,
  path,
  responseSchema,
  token,
}: {
  apiOrigin: string;
  body: unknown;
  idempotencyKey: string;
  path: string;
  responseSchema: { safeParse(value: unknown): { success: boolean; data?: Result } };
  token: string;
}): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CaptureApiError('Wip could not be reached. Your reviewed capture is still here.');
  }

  const payload = (await response.json().catch(() => undefined)) as
    { data?: unknown; error?: { code?: string; message?: string } } | undefined;
  if (!response.ok) {
    if (response.status === 401 || payload?.error?.code === 'authentication_required') {
      throw new CaptureApiError(
        'Your Wip session expired or was revoked. Sign in again; your reviewed job is still here.',
        'authentication_required',
      );
    }
    throw new CaptureApiError(
      payload?.error?.message ?? 'Wip could not save this capture. Try again.',
      payload?.error?.code,
    );
  }
  const parsed = responseSchema.safeParse(payload?.data);
  if (!parsed.success || parsed.data === undefined) {
    throw new CaptureApiError('Wip returned an unexpected capture response. Your draft is intact.');
  }
  return parsed.data;
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
  return captureRequest({
    apiOrigin,
    body: validated,
    idempotencyKey,
    path: '/api/v1/captures',
    responseSchema: extensionCaptureResponseSchema,
    token,
  });
}

export async function attachCaptureSnapshot({
  apiOrigin,
  command,
  idempotencyKey,
  token,
}: {
  apiOrigin: string;
  command: ExtensionSnapshotAttachmentCommand;
  idempotencyKey: string;
  token: string;
}): Promise<ExtensionSnapshotAttachmentResponse> {
  const validated = extensionSnapshotAttachmentCommandSchema.parse(command);
  return captureRequest({
    apiOrigin,
    body: validated,
    idempotencyKey,
    path: '/api/v1/captures/snapshots',
    responseSchema: extensionSnapshotAttachmentResponseSchema,
    token,
  });
}
