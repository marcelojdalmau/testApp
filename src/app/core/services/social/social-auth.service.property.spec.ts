import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as fc from 'fast-check';

import {
  SocialAuthService,
  PROVIDER_TIMEOUT_MS,
} from './social-auth.service';
import { SOCIAL_AUTH_STRATEGY, SocialAuthStrategy } from './social-auth-strategy';
import { AuthService } from '../auth.service';
import { API_BASE_URL } from '../../config/api.config';
import { LoginResponse } from '../../models/auth.model';
import {
  SocialAuthPendingContext,
  SocialProvider,
} from '../../models/social-auth.model';

/**
 * Property-based tests for SocialAuthService.
 * Feature: social-authentication
 *
 * These tests verify the round-trip of the pending context (state / Return_URL)
 * through the provider redirect: the `state` acts as the key under which the
 * preserved `Return_URL` is stored and later recovered. The real service read
 * path (`handleCallback`) is exercised: recovering the context with the same
 * `state` yields the exact same `Return_URL`, and recovering with a different
 * `state` does NOT recover the context.
 */

describe('Feature: social-authentication, Property 2: Round-trip del contexto (state / Return_URL) a través del redirect', () => {
  /**
   * **Validates: Requirements 8.6, 8.3**
   *
   * For every preserved `state` and `Return_URL` at the start of the flow,
   * recovering the pending context using that same `state` after the callback
   * returns exactly the same `Return_URL` without alteration, and recovering
   * with a different `state` does not return that context.
   */
  let service: SocialAuthService;
  let httpTestingController: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let strategyMock: jasmine.SpyObj<SocialAuthStrategy>;

  const apiBaseUrl = 'http://localhost:8000';
  const REDIRECT_URI = 'http://localhost:4200/auth/callback';
  const SOCIAL_PENDING_KEY = 'sora-sport-social-pending';
  const EXCHANGE_URL = `${apiBaseUrl}/auth/social/exchange`;

  /** Arbitrary that generates an opaque, non-empty `state` token. */
  const stateArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 64 });

  /**
   * Arbitrary that generates a valid internal Return_URL (starts with a single
   * `/`, no scheme/host, no `//`). `resolveReturnUrl` returns internal routes
   * unchanged, so exact equality of the round-trip can be asserted.
   */
  const internalReturnUrlArb: fc.Arbitrary<string> = fc
    .webPath()
    .filter((p) => p.startsWith('/') && !p.startsWith('//'));

  /** Arbitrary that generates one of the three supported providers. */
  const providerArb: fc.Arbitrary<SocialProvider> = fc.constantFrom<SocialProvider>(
    'google',
    'facebook',
    'apple',
  );

  /** Builds a complete LoginResponse so handleCallback finalizes successfully. */
  function buildLoginResponse(): LoginResponse {
    return {
      access_token: 'access-token',
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      default_tenant_id: 'tenant-123',
      roles: ['user'],
    };
  }

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    strategyMock = jasmine.createSpyObj('SocialAuthStrategy', [
      'authorize',
      'getRedirectUri',
    ]);
    strategyMock.getRedirectUri.and.returnValue(REDIRECT_URI);
    strategyMock.authorize.and.returnValue(Promise.resolve({ status: 'success' }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
        { provide: SOCIAL_AUTH_STRATEGY, useValue: strategyMock },
      ],
    });

    service = TestBed.inject(SocialAuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should recover the exact Return_URL when the callback state matches the preserved state', async () => {
    await fc.assert(
      fc.asyncProperty(
        stateArb,
        internalReturnUrlArb,
        providerArb,
        async (state: string, returnUrl: string, provider: SocialProvider) => {
          // Arrange: preserve the pending context under the given `state`,
          // as the service does when starting the flow before the redirect.
          const context: SocialAuthPendingContext = {
            state,
            code_verifier: 'verifier',
            provider,
            return_url: returnUrl,
            created_at: Date.now(),
          };
          localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(context));
          routerSpy.navigateByUrl.calls.reset();

          // Act: process the callback with the SAME `state` (real read path).
          const callback$ = service.handleCallback('auth-code', state);
          const responsePromise = firstValueFrom(callback$);

          // The exchange request must be issued because the state validated.
          const req = httpTestingController.expectOne(EXCHANGE_URL);
          req.flush(buildLoginResponse());

          await responsePromise;

          // Assert: navigation targets exactly the preserved Return_URL,
          // recovered unaltered through the redirect via the `state` key.
          expect(routerSpy.navigateByUrl).toHaveBeenCalledOnceWith(returnUrl);

          // Reset for the next generated example.
          httpTestingController.verify();
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should NOT recover the context when the callback state differs from the preserved state', async () => {
    await fc.assert(
      fc.asyncProperty(
        stateArb,
        stateArb,
        internalReturnUrlArb,
        providerArb,
        async (
          preservedState: string,
          otherState: string,
          returnUrl: string,
          provider: SocialProvider,
        ) => {
          // Only exercise the mismatch case: distinct states.
          fc.pre(preservedState !== otherState);

          // Arrange: preserve the pending context under `preservedState`.
          const context: SocialAuthPendingContext = {
            state: preservedState,
            code_verifier: 'verifier',
            provider,
            return_url: returnUrl,
            created_at: Date.now(),
          };
          localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(context));
          routerSpy.navigateByUrl.calls.reset();

          // Act: process the callback with a DIFFERENT `state`.
          const callback$ = service.handleCallback('auth-code', otherState);

          // Assert: the context is not recovered, so the flow aborts with an
          // invalid-state error and never issues the exchange request.
          await expectAsync(firstValueFrom(callback$)).toBeRejected();

          // No exchange request must have been made.
          httpTestingController.expectNone(EXCHANGE_URL);

          // No navigation to the Return_URL must have occurred.
          expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();

          // Reset for the next generated example.
          httpTestingController.verify();
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: social-authentication, Property 7: La solicitud de intercambio nunca incluye tenant', () => {
  /**
   * **Validates: Requirements 10.1, 10.5**
   *
   * For every entry context — including ones where a spurious tenant/institution
   * identifier has been injected into the persisted pending context — the
   * `SocialExchangeRequest` built by `handleCallback` and POSTed to
   * `/auth/social/exchange` contains EXACTLY the keys
   * { provider, code, code_verifier, redirect_uri } and never any
   * tenant/institution field.
   */
  let service: SocialAuthService;
  let httpTestingController: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let strategyMock: jasmine.SpyObj<SocialAuthStrategy>;

  const apiBaseUrl = 'http://localhost:8000';
  const REDIRECT_URI = 'http://localhost:4200/auth/callback';
  const SOCIAL_PENDING_KEY = 'sora-sport-social-pending';
  const EXCHANGE_URL = `${apiBaseUrl}/auth/social/exchange`;

  /** The one and only set of keys the exchange request body may contain. */
  const ALLOWED_KEYS = ['code', 'code_verifier', 'provider', 'redirect_uri'];

  /** Arbitrary that generates an opaque, non-empty `state` token. */
  const stateArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 64 });

  /** Arbitrary that generates a non-empty authorization `code`. */
  const codeArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 64 });

  /** Arbitrary that generates a non-empty PKCE `code_verifier`. */
  const codeVerifierArb: fc.Arbitrary<string> = fc.string({
    minLength: 1,
    maxLength: 128,
  });

  /** Arbitrary that generates one of the three supported providers. */
  const providerArb: fc.Arbitrary<SocialProvider> = fc.constantFrom<SocialProvider>(
    'google',
    'facebook',
    'apple',
  );

  /**
   * Arbitrary that generates spurious tenant/institution fields to inject into
   * the persisted pending context, simulating a "tenant injected" scenario.
   * Sometimes empty (no injection) so both paths are covered.
   */
  const tenantInjectionArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
    fc.constantFrom(
      'tenant',
      'tenant_id',
      'tenantId',
      'institution',
      'institution_id',
      'institutionId',
      'club',
      'club_id',
    ),
    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
    { maxKeys: 4 },
  );

  /** Builds a complete LoginResponse so handleCallback finalizes successfully. */
  function buildLoginResponse(): LoginResponse {
    return {
      access_token: 'access-token',
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      default_tenant_id: 'tenant-123',
      roles: ['user'],
    };
  }

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    strategyMock = jasmine.createSpyObj('SocialAuthStrategy', [
      'authorize',
      'getRedirectUri',
    ]);
    strategyMock.getRedirectUri.and.returnValue(REDIRECT_URI);
    strategyMock.authorize.and.returnValue(Promise.resolve({ status: 'success' }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
        { provide: SOCIAL_AUTH_STRATEGY, useValue: strategyMock },
      ],
    });

    service = TestBed.inject(SocialAuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should build an exchange request whose body keys are exactly { provider, code, code_verifier, redirect_uri } and never include a tenant/institution field', async () => {
    await fc.assert(
      fc.asyncProperty(
        stateArb,
        codeArb,
        codeVerifierArb,
        providerArb,
        tenantInjectionArb,
        async (
          state: string,
          code: string,
          codeVerifier: string,
          provider: SocialProvider,
          tenantInjection: Record<string, unknown>,
        ) => {
          // Arrange: persist the pending context under `state`, and inject any
          // spurious tenant/institution fields into that persisted object to
          // simulate a tenant identifier leaking into the entry context.
          const context: SocialAuthPendingContext = {
            state,
            code_verifier: codeVerifier,
            provider,
            return_url: null,
            created_at: Date.now(),
          };
          const persisted = { ...context, ...tenantInjection };
          localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(persisted));

          // Act: process the callback with the matching `state`.
          const callback$ = service.handleCallback(code, state);
          const responsePromise = firstValueFrom(callback$);

          // Capture the outgoing exchange request body.
          const req = httpTestingController.expectOne(EXCHANGE_URL);
          const body = req.request.body as Record<string, unknown>;

          // Assert: the body keys are EXACTLY the four allowed keys — no
          // tenant/institution key is present, regardless of injection.
          expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS);

          // And the values are exactly those from the recovered context / call.
          expect(body['provider']).toBe(provider);
          expect(body['code']).toBe(code);
          expect(body['code_verifier']).toBe(codeVerifier);
          expect(body['redirect_uri']).toBe(REDIRECT_URI);

          // Complete the flow so no request stays outstanding.
          req.flush(buildLoginResponse());
          await responsePromise;

          // Reset for the next generated example.
          httpTestingController.verify();
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: social-authentication, Property 4: Atomicidad del estado ante fallo o TokenPair inválido', () => {
  /**
   * **Validates: Requirements 1.11, 1.12, 2.6, 5.6, 5.7, 7.6**
   *
   * For every negative outcome of the social flow — provider cancellation,
   * provider error, network failure, timeout, or backend error — and for every
   * incomplete `TokenPair` (missing or empty in at least one of the four
   * required fields: access_token, id_token, refresh_token, expires_in), after
   * the flow settles:
   * - No tokens are stored (partial or otherwise) in TokenStorageService.
   * - No roles are stored (partial or otherwise) in TokenStorageService.
   * - `isAuthenticated` remains false.
   * - `isLoading` is left in false.
   *
   * The real read path (`handleCallback`) is exercised: a valid pending context
   * is seeded, the callback runs, and the exchange request is completed with the
   * generated negative outcome (an error status, a network failure, a backend
   * 5xx, or an incomplete `TokenPair` body). The timeout branch is exercised
   * with `fakeAsync`/`tick` by advancing past the provider timeout without
   * responding.
   */
  const apiBaseUrl = 'http://localhost:8000';
  const REDIRECT_URI = 'http://localhost:4200/auth/callback';
  const SOCIAL_PENDING_KEY = 'sora-sport-social-pending';
  const TOKENS_KEY = 'sora-sport-auth-tokens';
  const ROLES_KEY = 'sora-sport-auth-roles';
  const EXCHANGE_URL = `${apiBaseUrl}/auth/social/exchange`;

  /** Arbitrary that generates an opaque, non-empty `state` token. */
  const stateArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 64 });

  /** Arbitrary that generates one of the three supported providers. */
  const providerArb: fc.Arbitrary<SocialProvider> = fc.constantFrom<SocialProvider>(
    'google',
    'facebook',
    'apple',
  );

  /**
   * Arbitrary describing an HTTP-level negative outcome delivered when the
   * exchange request is flushed. Covers provider error (400), network failure
   * (status 0), backend error (5xx) and other backend statuses (202/409).
   */
  type HttpNegativeOutcome =
    | { kind: 'network' }
    | { kind: 'status'; status: number; body: Record<string, unknown> };

  const httpNegativeOutcomeArb: fc.Arbitrary<HttpNegativeOutcome> = fc.oneof(
    fc.constant<HttpNegativeOutcome>({ kind: 'network' }),
    fc
      .constantFrom(400, 202, 409, 500, 502, 503)
      .map(
        (status) =>
          ({ kind: 'status', status, body: {} }) as HttpNegativeOutcome,
      ),
  );

  /**
   * Arbitrary that generates an incomplete `TokenPair` response body: a body
   * where at least one of the four required fields is missing or empty. Starts
   * from a complete set of fields, then removes or blanks at least one.
   */
  const incompleteTokenBodyArb: fc.Arbitrary<Record<string, unknown>> = fc
    .subarray(
      ['access_token', 'id_token', 'refresh_token', 'expires_in'] as const,
      { minLength: 1, maxLength: 4 },
    )
    .chain((fieldsToBreak) =>
      fc.record({
        blankInsteadOfMissing: fc.boolean(),
      }).map(({ blankInsteadOfMissing }) => {
        const body: Record<string, unknown> = {
          access_token: 'access-token',
          id_token: 'id-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          roles: ['user'],
        };
        for (const field of fieldsToBreak) {
          if (blankInsteadOfMissing) {
            // Empty/falsy values: '' for strings, 0 for expires_in.
            body[field] = field === 'expires_in' ? 0 : '';
          } else {
            delete body[field];
          }
        }
        return body;
      }),
    );

  /** Seeds a valid pending context under `state` and resets router spy calls. */
  function seedContext(
    state: string,
    provider: SocialProvider,
  ): void {
    const context: SocialAuthPendingContext = {
      state,
      code_verifier: 'verifier',
      provider,
      return_url: null,
      created_at: Date.now(),
    };
    localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(context));
  }

  /** Asserts that no session state leaked: no tokens/roles, not authenticated, not loading. */
  function assertAtomicNoSession(): void {
    // No partial tokens or roles were stored.
    expect(localStorage.getItem(TOKENS_KEY)).toBeNull();
    expect(localStorage.getItem(ROLES_KEY)).toBeNull();

    const authService = TestBed.inject(AuthService);
    expect(authService.getAccessToken()).toBeNull();
    expect(authService.userRoles()).toEqual([]);

    // isAuthenticated remains false and isLoading is released.
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.isLoading()).toBe(false);

    // The pending context is cleared on every negative outcome.
    expect(localStorage.getItem(SOCIAL_PENDING_KEY)).toBeNull();
  }

  function configureTestBed(): {
    service: SocialAuthService;
    httpTestingController: HttpTestingController;
  } {
    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    const strategyMock = jasmine.createSpyObj<SocialAuthStrategy>(
      'SocialAuthStrategy',
      ['authorize', 'getRedirectUri'],
    );
    strategyMock.getRedirectUri.and.returnValue(REDIRECT_URI);
    strategyMock.authorize.and.returnValue(Promise.resolve({ status: 'success' }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
        { provide: SOCIAL_AUTH_STRATEGY, useValue: strategyMock },
      ],
    });

    return {
      service: TestBed.inject(SocialAuthService),
      httpTestingController: TestBed.inject(HttpTestingController),
    };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should not store partial tokens/roles and keep isAuthenticated/isLoading false when the exchange fails (network, provider or backend error)', async () => {
    await fc.assert(
      fc.asyncProperty(
        stateArb,
        providerArb,
        httpNegativeOutcomeArb,
        async (
          state: string,
          provider: SocialProvider,
          outcome: HttpNegativeOutcome,
        ) => {
          TestBed.resetTestingModule();
          localStorage.clear();
          const { service, httpTestingController } = configureTestBed();

          seedContext(state, provider);

          // Act: process the callback with the matching `state`.
          const settled = expectAsync(
            firstValueFrom(service.handleCallback('auth-code', state)),
          ).toBeRejected();

          // The exchange request is issued because the state validated.
          const req = httpTestingController.expectOne(EXCHANGE_URL);
          if (outcome.kind === 'network') {
            req.error(new ProgressEvent('error'), { status: 0 });
          } else {
            req.flush(outcome.body, {
              status: outcome.status,
              statusText: 'Error',
            });
          }

          await settled;

          // Assert: state is atomic — nothing partial persisted.
          assertAtomicNoSession();

          httpTestingController.verify();
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should not store partial tokens/roles and keep isAuthenticated/isLoading false when the backend returns an incomplete TokenPair', async () => {
    await fc.assert(
      fc.asyncProperty(
        stateArb,
        providerArb,
        incompleteTokenBodyArb,
        async (
          state: string,
          provider: SocialProvider,
          incompleteBody: Record<string, unknown>,
        ) => {
          TestBed.resetTestingModule();
          localStorage.clear();
          const { service, httpTestingController } = configureTestBed();

          seedContext(state, provider);

          // Act: process the callback; the backend answers 200 but with an
          // incomplete TokenPair (missing/blank in at least one field).
          const settled = expectAsync(
            firstValueFrom(service.handleCallback('auth-code', state)),
          ).toBeRejected();

          const req = httpTestingController.expectOne(EXCHANGE_URL);
          req.flush(incompleteBody);

          await settled;

          // Assert: the incomplete TokenPair is discarded — no partial session.
          assertAtomicNoSession();

          httpTestingController.verify();
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should not store partial tokens/roles and keep isAuthenticated/isLoading false when the provider result is a cancellation or error (invalid state)', async () => {
    await fc.assert(
      fc.asyncProperty(
        stateArb,
        stateArb,
        providerArb,
        async (
          preservedState: string,
          callbackState: string,
          provider: SocialProvider,
        ) => {
          // Exercise the mismatched-state path, which the service treats as a
          // provider error / cancellation: the flow aborts before any exchange.
          fc.pre(preservedState !== callbackState);

          TestBed.resetTestingModule();
          localStorage.clear();
          const { service, httpTestingController } = configureTestBed();

          seedContext(preservedState, provider);

          // Act: process the callback with a DIFFERENT `state`.
          await expectAsync(
            firstValueFrom(service.handleCallback('auth-code', callbackState)),
          ).toBeRejected();

          // No exchange request is issued on the aborted flow.
          httpTestingController.expectNone(EXCHANGE_URL);

          // Assert: no partial session leaked.
          assertAtomicNoSession();

          httpTestingController.verify();
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should not store partial tokens/roles and keep isAuthenticated/isLoading false when the provider flow times out', () => {
    // The timeout branch relies on the RxJS `timeout` operator, exercised here
    // with the fake clock. `fakeAsync` cannot be combined with fast-check's
    // async runner, so iterate the generated states manually inside the zone.
    const samples = fc.sample(fc.tuple(stateArb, providerArb), 100);

    for (const [state, provider] of samples) {
      fakeAsync(() => {
        TestBed.resetTestingModule();
        localStorage.clear();
        const { service, httpTestingController } = configureTestBed();

        seedContext(state, provider);

        let rejected = false;
        service.handleCallback('auth-code', state).subscribe({
          next: () => {
            /* no success expected */
          },
          error: () => {
            rejected = true;
          },
        });

        // A request is pending but never answered: let it time out.
        const req = httpTestingController.expectOne(EXCHANGE_URL);
        expect(req.request.method).toBe('POST');

        // Advance past the provider timeout.
        tick(PROVIDER_TIMEOUT_MS);

        expect(rejected).toBe(true);

        // Assert: timeout is a negative outcome — no partial session persisted.
        assertAtomicNoSession();

        httpTestingController.verify();
        localStorage.clear();
      })();
    }
  });
});
