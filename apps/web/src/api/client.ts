'use client';

export class ApiResponseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

export async function apiMutation<T>({
  url,
  method,
  body,
  idempotencyKey,
}: {
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
}): Promise<T | undefined> {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 204) return undefined;
  const payload = (await response.json()) as {
    data?: T;
    error?: { code?: string; message?: string; fields?: Record<string, string[]> };
  };
  if (!response.ok) {
    throw new ApiResponseError(
      payload.error?.message ?? 'Wip could not save that change.',
      payload.error?.code ?? 'unknown_error',
      response.status,
      payload.error?.fields,
    );
  }
  return payload.data;
}

export function createIdempotencyKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}
