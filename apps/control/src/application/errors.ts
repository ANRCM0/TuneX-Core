export class ControlError extends Error {
  readonly code: string;
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503;
  readonly retryable: boolean;
  constructor(code: string, status: ControlError['status'], message: string, retryable = false) { super(message); this.code=code;this.status=status;this.retryable=retryable; }
}
export function invalid(message: string): never { throw new ControlError('INVALID_CONFIG', 422, message); }
export function notFound(): never { throw new ControlError('NOT_FOUND', 404, 'Resource not found'); }
