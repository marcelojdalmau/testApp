import * as fc from 'fast-check';

import { isInternalReturnUrl, resolveReturnUrl } from './return-url.validator';

/**
 * Property-based tests for the Return_URL validator.
 * Feature: social-authentication
 *
 * These tests verify that the anti open-redirect validator only accepts
 * safe internal relative paths, and that `resolveReturnUrl` returns either
 * the validated internal path or the fallback (`/feed`).
 */

const FALLBACK = '/feed';

/** Single URL path segment built from URL-safe characters. */
const segmentArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_.~'.split('')),
  minLength: 1,
  maxLength: 20,
});

/**
 * Valid internal relative path: starts with a single `/`, no scheme, no host,
 * no control characters, and never begins with `//`.
 */
const internalPathArb: fc.Arbitrary<string> = fc
  .array(segmentArb, { minLength: 1, maxLength: 5 })
  .map((segments) => '/' + segments.join('/'));

/** Protocol-relative / host-based paths: `//host`, `/\host`. */
const protocolRelativeArb: fc.Arbitrary<string> = fc.oneof(
  segmentArb.map((host) => '//' + host),
  segmentArb.map((host) => '/\\' + host),
);

/** Absolute external URLs with an explicit scheme. */
const absoluteUrlArb: fc.Arbitrary<string> = fc
  .tuple(fc.constantFrom('http', 'https', 'ftp'), segmentArb)
  .map(([scheme, host]) => `${scheme}://${host}.example.com/path`);

/** Dangerous scheme URLs (e.g. `javascript:`, `data:`). */
const dangerousSchemeArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant('javascript:alert(1)'),
  fc.constant('data:text/html,<script>alert(1)</script>'),
  fc.constant('vbscript:msgbox(1)'),
  segmentArb.map((s) => `javascript:${s}`),
);

/** Empty / whitespace-only / relative-without-leading-slash candidates. */
const invalidMiscArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  segmentArb, // relative path without a leading slash
);

/** Any non-internal (rejected) candidate. */
const nonInternalArb: fc.Arbitrary<string> = fc.oneof(
  protocolRelativeArb,
  absoluteUrlArb,
  dangerousSchemeArb,
  invalidMiscArb,
);

describe('Feature: social-authentication, Property 1: Return_URL validation only accepts internal paths', () => {
  /**
   * **Validates: Requirements 8.3, 8.4, 1.6, 1.7**
   *
   * For any internal relative path, `isInternalReturnUrl` SHALL return true and
   * `resolveReturnUrl` SHALL return that path. For any external, protocol-relative,
   * scheme-bearing, empty or otherwise invalid candidate, `isInternalReturnUrl`
   * SHALL return false and `resolveReturnUrl` SHALL return the fallback (`/feed`).
   */

  it('accepts internal relative paths and resolves them to themselves', () => {
    fc.assert(
      fc.property(internalPathArb, (url: string) => {
        expect(isInternalReturnUrl(url)).toBe(true);
        expect(resolveReturnUrl(url, FALLBACK)).toBe(url);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects non-internal candidates and resolves them to the fallback', () => {
    fc.assert(
      fc.property(nonInternalArb, (url: string) => {
        expect(isInternalReturnUrl(url)).toBe(false);
        expect(resolveReturnUrl(url, FALLBACK)).toBe(FALLBACK);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects null and resolves it to the fallback', () => {
    expect(isInternalReturnUrl(null)).toBe(false);
    expect(resolveReturnUrl(null, FALLBACK)).toBe(FALLBACK);
  });

  it('never accepts protocol-relative paths (//host, /\\host)', () => {
    fc.assert(
      fc.property(protocolRelativeArb, (url: string) => {
        expect(isInternalReturnUrl(url)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
