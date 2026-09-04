import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';

import {
  SocialAuthorizeRequest,
  SocialProvider,
} from '../../models/social-auth.model';
import { SOCIAL_AUTH_SCOPES } from './social-auth-strategy';
import { WebSocialAuthStrategy } from './web-social-auth.strategy';

/**
 * Property-based tests for the Web social auth strategy.
 * Feature: social-authentication
 *
 * These tests verify that the authorize URL built for the OAuth 2.0
 * Authorization Code + PKCE flow requests exactly the profile scopes
 * `{ email, name }` and nothing else, for every supported provider.
 */

describe('Feature: social-authentication, Property 6: Los scopes solicitados se limitan a correo y nombre', () => {
  let strategy: WebSocialAuthStrategy;

  /** The three supported federated providers. */
  const providerArb: fc.Arbitrary<SocialProvider> = fc.constantFrom<SocialProvider>(
    'google',
    'facebook',
    'apple',
  );

  /** The exact set of scopes the flow is allowed to request. */
  const EXPECTED_SCOPES: ReadonlySet<string> = new Set(
    Object.values(SOCIAL_AUTH_SCOPES),
  );

  beforeEach(() => {
    TestBed.configureTestingModule({});
    strategy = TestBed.inject(WebSocialAuthStrategy);
  });

  /**
   * Builds the authorize URL for a request without triggering navigation.
   *
   * `authorize()` ends by calling `window.location.assign(url)`, which cannot
   * be spied in the test browser (`assign` is not writable) and would leave the
   * page. Instead we invoke the private URL builder directly through bracket
   * access, exercising the real scope-building logic while staying on the page.
   */
  function buildAuthorizeUrl(request: SocialAuthorizeRequest): string {
    return (
      strategy as unknown as {
        buildAuthorizeUrl(req: SocialAuthorizeRequest): string;
      }
    ).buildAuthorizeUrl(request);
  }

  /**
   * **Validates: Requirements 9.1, 9.2**
   *
   * For every supported provider, the authorize URL built by the Web strategy
   * carries a `scope` query param whose set of values equals exactly
   * `{ email, name }`, without any additional profile field.
   */
  it('should request exactly the {email, name} scopes for every provider', () => {
    fc.assert(
      fc.property(providerArb, (provider: SocialProvider) => {
        const request: SocialAuthorizeRequest = {
          provider,
          code_challenge: 'test-code-challenge',
          state: 'test-state',
          redirect_uri: `${window.location.origin}/auth/callback`,
        };

        const capturedUrl = buildAuthorizeUrl(request);

        // The strategy must have built a truthy authorize URL.
        expect(capturedUrl).toBeTruthy();

        const url = new URL(capturedUrl);
        const scopeParam = url.searchParams.get('scope');

        // A scope parameter is always present.
        expect(scopeParam).toBeTruthy();

        const requestedScopes = new Set(
          String(scopeParam)
            .split(' ')
            .filter((s) => s.length > 0),
        );

        // The requested scope set is exactly {email, name}: same size and
        // every requested scope belongs to the expected set (no extras) and
        // every expected scope is present (nothing missing).
        expect(requestedScopes.size).toBe(EXPECTED_SCOPES.size);
        for (const scope of requestedScopes) {
          expect(EXPECTED_SCOPES.has(scope)).toBeTrue();
        }
        for (const expected of EXPECTED_SCOPES) {
          expect(requestedScopes.has(expected)).toBeTrue();
        }
      }),
      { numRuns: 100 },
    );
  });
});
