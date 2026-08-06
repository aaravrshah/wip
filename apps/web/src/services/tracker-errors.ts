export type TrackerErrorCode =
  | 'authentication_required'
  | 'conflict'
  | 'demo_read_only'
  | 'idempotency_conflict'
  | 'not_found'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'validation_error';

export class TrackerError extends Error {
  constructor(
    public readonly code: TrackerErrorCode,
    message: string,
    public readonly status: number,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'TrackerError';
  }
}

export function notFoundError() {
  return new TrackerError('not_found', 'The requested application was not found.', 404);
}

export function conflictError(message = 'This record changed in another tab. Refresh and retry.') {
  return new TrackerError('conflict', message, 409);
}
