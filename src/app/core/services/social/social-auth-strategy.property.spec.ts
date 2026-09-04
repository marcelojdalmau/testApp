import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';

import {
  SocialAuthorizeRequest,
  SocialPlatform,
  SocialProvider,
} from '../../models/social-auth.model';
import { SocialAuthStrategy } from './social-auth-strategy';
import { resolveSocialAuthStrategy } from './social-auth-strategy.provider';
import { WebSocialAuthStrategy } from './web-social-auth.strategy';
import { NativeSocialAuthStrategy } from './native-social-auth.strategy';

/**
 * Property-based tests for the platform strategy resolver.
 * Feature: social-authentication
 *
 * These tests verify that, for every target platform, the resolver always
 * returns a non-null strategy that is able to offer the three federated
 * providers (Google, Facebook, Apple).
 */

describe('Feature: social-authentication, Property 5: Resolución de estrategia por plataforma', () => {
  /**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   *
   * For every platform in `{ web, android, ios }`, `resolveSocialAuthStrategy`
   * returns a non-null `SocialAuthStrategy`, and that strategy offers the three
   * providers (`google`, `facebook`, `apple`): building the redirect URI and
   * starting the authorize flow works for each provider without throwing.
   */
  let webStrategy: WebSocialAuthStrategy;
  let nativeStrategy: NativeSocialAuthStrategy;

  /** Arbitrary that generates one of the three target platforms. */
  const platformArb: fc.Arbitrary<SocialPlatform> = fc.constantFrom<SocialPlatform>(
    'web',
    'android',
    'ios',
  );

  /** The three federated providers a strategy must offer. */
  const ALL_PROVIDERS: readonly SocialProvider[] = ['google', 'facebook', 'apple'];

  beforeEach(() => {
    TestBed.configureTestingModule({});

    webStrategy = TestBed.inject(WebSocialAuthStrategy);
    nativeStrategy = TestBed.inject(NativeSocialAuthStrategy);

    // Avoid triggering a real navigation from the Web strategy's authorize().
    // `window.location.assign` is not configurable/spyable in the test browser,
    // so we stub the strategy's authorize() to exercise the resolver and the
    // provider handling without leaving the page. getRedirectUri() (and thus
    // the real per-platform redirect_uri) is left intact.
    spyOn(webStrategy, 'authorize').and.callFake(
      (request: SocialAuthorizeRequest) => {
        void request;
        return Promise.resolve({ status: 'success' as const });
      },
    );
  });

  it('should resolve a non-null strategy offering the three providers for every platform', async () => {
    await fc.assert(
      fc.asyncProperty(platformArb, async (platform: SocialPlatform) => {
        // Act: resolve the strategy for the generated platform.
        const strategy: SocialAuthStrategy = resolveSocialAuthStrategy(
          platform,
          webStrategy,
          nativeStrategy,
        );

        // Assert: a non-null strategy is always resolved.
        expect(strategy).toBeTruthy();

        // Assert: the strategy exposes both contract methods.
        expect(typeof strategy.authorize).toBe('function');
        expect(typeof strategy.getRedirectUri).toBe('function');

        // A single redirect_uri per platform is reused across providers.
        const redirectUri = strategy.getRedirectUri();
        expect(typeof redirectUri).toBe('string');
        expect(redirectUri.length).toBeGreaterThan(0);

        // Assert: the strategy offers each of the three providers, i.e. it can
        // start the authorize flow for every provider without throwing.
        for (const provider of ALL_PROVIDERS) {
          const request: SocialAuthorizeRequest = {
            provider,
            code_challenge: 'test-code-challenge',
            state: 'test-state',
            redirect_uri: redirectUri,
          };

          const result = await strategy.authorize(request);

          // authorize() always resolves to a well-formed result object.
          expect(result).toBeTruthy();
          expect(['success', 'cancelled', 'error']).toContain(result.status);
        }
      }),
      { numRuns: 100 },
    );
  });
});
