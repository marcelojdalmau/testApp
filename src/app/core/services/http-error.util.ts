import { HttpErrorResponse } from '@angular/common/http';

import { AuthError } from '../models/auth.model';

/**
 * Maps an {@link HttpErrorResponse} to the shared {@link AuthError} shape.
 *
 * This is the single source of truth for HTTP → `AuthError` mapping so that every
 * service (`AuthService`, `ProfileService`, ...) produces an identical contract and
 * cannot drift apart. It preserves the exact behaviour originally implemented in
 * `AuthService.handleError`:
 *
 * - `status === 0` → connectivity `AuthError` (also used for a 10s request timeout,
 *   which callers normalise to a status-0 error before delegating here).
 * - Otherwise, safely extract the backend message from the `Error_Body`, reading its
 *   fields in precedence order — `error` (shape `{ error: string }`, kept first for
 *   register-reform Req 3/4 compatibility), then `message`, then `detail`. Each read
 *   is guarded (must be a readable string) so a present-but-malformed body (a string,
 *   a number, or an object whose fields are not readable strings) falls through to the
 *   generic fallback rather than throwing.
 * - The optional `error` field always mirrors the `Error_Body.error` code when present
 *   (independently of which field supplied the human-readable `message`).
 */
export function mapHttpErrorToAuthError(error: HttpErrorResponse): AuthError {
  if (error.status === 0) {
    return {
      statusCode: 0,
      message: 'Unable to connect. Check your internet connection.',
    };
  }

  // Attempt extraction from the Error_Body, reading fields in precedence order:
  // `error` (Req 7.1), then `message`, then `detail`. A body may be present but
  // malformed/corrupted (e.g. a string, a number, or an object whose fields are not
  // readable strings); guard each read so a failed extraction falls through to the
  // generic fallback rather than throwing.
  let backendError: string | undefined;
  let backendMessage: string | undefined;
  try {
    const body = error.error;
    backendError = typeof body?.error === 'string' ? body.error : undefined;
    const message = typeof body?.message === 'string' ? body.message : undefined;
    const detail = typeof body?.detail === 'string' ? body.detail : undefined;
    backendMessage = backendError ?? message ?? detail;
  } catch {
    backendError = undefined;
    backendMessage = undefined;
  }

  return {
    statusCode: error.status,
    message: backendMessage ?? 'An unexpected error occurred. Please try again.',
    error: backendError,
  };
}
