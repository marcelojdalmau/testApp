import { HttpErrorResponse } from '@angular/common/http';

import { mapHttpErrorToAuthError } from './http-error.util';

/**
 * Unit tests for `mapHttpErrorToAuthError`.
 *
 * Covers the four behavioural cases the helper is the single source of truth for:
 * - status 0 (connectivity)
 * - a readable `Error_Body.error` message
 * - an empty/unreadable `Error_Body` (generic fallback)
 * - other statuses
 *
 * Validates: Requirements 3.6, 4.3, 4.4
 */
describe('mapHttpErrorToAuthError', () => {
  /** Build an HttpErrorResponse with the given status and error body. */
  const makeError = (status: number, error?: unknown): HttpErrorResponse =>
    new HttpErrorResponse({ status, error });

  describe('status 0 (connectivity)', () => {
    it('maps a status-0 error to the connectivity AuthError', () => {
      const result = mapHttpErrorToAuthError(makeError(0));

      expect(result.statusCode).toBe(0);
      expect(result.message).toBe('Unable to connect. Check your internet connection.');
    });

    it('ignores any body on a status-0 error', () => {
      const result = mapHttpErrorToAuthError(makeError(0, { error: 'backend says hi' }));

      expect(result.statusCode).toBe(0);
      expect(result.message).toBe('Unable to connect. Check your internet connection.');
      expect(result.error).toBeUndefined();
    });
  });

  describe('readable Error_Body', () => {
    it('carries the backend message when Error_Body.error is a readable string', () => {
      const result = mapHttpErrorToAuthError(
        makeError(409, { error: 'Email already registered' }),
      );

      expect(result.statusCode).toBe(409);
      expect(result.message).toBe('Email already registered');
      expect(result.error).toBe('Email already registered');
    });

    it('mirrors the backend message on both message and error fields', () => {
      const result = mapHttpErrorToAuthError(makeError(400, { error: 'Invalid input' }));

      expect(result.message).toBe('Invalid input');
      expect(result.error).toBe('Invalid input');
    });
  });

  describe('message/detail extraction (precedence after `error`)', () => {
    it('uses `message` for the human-readable text when `error` is absent', () => {
      const result = mapHttpErrorToAuthError(makeError(401, { message: 'Invalid credentials' }));

      expect(result.statusCode).toBe(401);
      expect(result.message).toBe('Invalid credentials');
      expect(result.error).toBeUndefined();
    });

    it('uses `detail` for the human-readable text when `error` and `message` are absent', () => {
      const result = mapHttpErrorToAuthError(makeError(422, { detail: 'Detailed error' }));

      expect(result.message).toBe('Detailed error');
      expect(result.error).toBeUndefined();
    });

    it('prefers `error` over `message` and `detail` for the human-readable text', () => {
      const result = mapHttpErrorToAuthError(
        makeError(400, { error: 'From error', message: 'From message', detail: 'From detail' }),
      );

      expect(result.message).toBe('From error');
      expect(result.error).toBe('From error');
    });

    it('keeps `error` as the code field while `message` supplies the human-readable text', () => {
      const result = mapHttpErrorToAuthError(
        makeError(401, { message: 'Invalid credentials', error: 'INVALID_CREDENTIALS' }),
      );

      expect(result.error).toBe('INVALID_CREDENTIALS');
      expect(result.message).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('empty or unreadable Error_Body (generic fallback)', () => {
    const genericMessage = 'An unexpected error occurred. Please try again.';

    it('falls back to the generic message when the body is null', () => {
      const result = mapHttpErrorToAuthError(makeError(500, null));

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe(genericMessage);
      expect(result.error).toBeUndefined();
    });

    it('extracts the `detail` field for the message but leaves the `error` code unset', () => {
      // The `error` code field only ever mirrors `Error_Body.error`; the human-readable
      // `message` falls back through `message` then `detail` when `error` is absent.
      const result = mapHttpErrorToAuthError(makeError(500, { detail: 'something' }));

      expect(result.message).toBe('something');
      expect(result.error).toBeUndefined();
    });

    it('falls back when the body is a plain string (not an object)', () => {
      const result = mapHttpErrorToAuthError(makeError(500, 'plain text body'));

      expect(result.message).toBe(genericMessage);
      expect(result.error).toBeUndefined();
    });

    it('falls back when the body is a number', () => {
      const result = mapHttpErrorToAuthError(makeError(500, 42));

      expect(result.message).toBe(genericMessage);
      expect(result.error).toBeUndefined();
    });

    it('falls back when `error` is present but not a string', () => {
      const result = mapHttpErrorToAuthError(makeError(400, { error: { nested: true } }));

      expect(result.message).toBe(genericMessage);
      expect(result.error).toBeUndefined();
    });

    it('falls back when `error` is an empty object', () => {
      const result = mapHttpErrorToAuthError(makeError(422, {}));

      expect(result.message).toBe(genericMessage);
      expect(result.error).toBeUndefined();
    });
  });

  describe('other statuses', () => {
    it('preserves the original status code for a 404', () => {
      const result = mapHttpErrorToAuthError(makeError(404, { error: 'Not found' }));

      expect(result.statusCode).toBe(404);
      expect(result.message).toBe('Not found');
      expect(result.error).toBe('Not found');
    });

    it('preserves the original status code for a 500 with a readable body', () => {
      const result = mapHttpErrorToAuthError(makeError(500, { error: 'Server exploded' }));

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Server exploded');
      expect(result.error).toBe('Server exploded');
    });
  });
});
