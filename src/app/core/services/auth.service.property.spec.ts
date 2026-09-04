import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import * as fc from 'fast-check';

import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { API_BASE_URL } from '../config/api.config';
import { TokenPair } from '../models/auth.model';

/**
 * Property-based tests for AuthService.
 * Feature: authentication
 *
 * These tests verify that logout always clears all stored state
 * regardless of the initial authentication state.
 */

describe('Feature: authentication, Property 7: Logout clears all stored state', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any initial authentication state (tokens, roles stored),
   * after invoking `AuthService.logout()`, all token and role storage
   * SHALL be empty and `isAuthenticated` SHALL be false.
   */
  let authService: AuthService;
  let tokenStorage: TokenStorageService;
  let httpTestingController: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const apiBaseUrl = 'http://localhost:8000';

  /** Arbitrary that generates valid TokenPair objects */
  const tokenPairArb: fc.Arbitrary<TokenPair> = fc.record({
    access_token: fc.string({ minLength: 1 }),
    id_token: fc.string({ minLength: 1 }),
    refresh_token: fc.string({ minLength: 1 }),
    expires_in: fc.integer({ min: 1 }),
  });

  /** Arbitrary that generates non-empty role arrays */
  const rolesArb: fc.Arbitrary<string[]> = fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 });

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
      ],
    });

    authService = TestBed.inject(AuthService);
    tokenStorage = TestBed.inject(TokenStorageService);
    httpTestingController = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('should clear all tokens, roles, and set isAuthenticated to false after logout (success response)', () => {
    fc.assert(
      fc.property(tokenPairArb, rolesArb, (tokens: TokenPair, roles: string[]) => {
        // Arrange: pre-populate storage with tokens and roles
        tokenStorage.storeTokens(tokens);
        tokenStorage.storeRoles(roles);

        // Act: invoke logout
        authService.logout();

        // Flush the POST request with a success response
        const req = httpTestingController.expectOne(`${apiBaseUrl}/auth/logout`);
        expect(req.request.method).toBe('POST');
        req.flush(null);

        // Assert: all storage is cleared
        expect(tokenStorage.getAccessToken()).toBeNull();
        expect(tokenStorage.getRefreshToken()).toBeNull();
        expect(tokenStorage.getIdToken()).toBeNull();
        expect(tokenStorage.getRoles()).toEqual([]);
        expect(authService.isAuthenticated()).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('should clear all tokens, roles, and set isAuthenticated to false after logout (error response)', () => {
    fc.assert(
      fc.property(tokenPairArb, rolesArb, (tokens: TokenPair, roles: string[]) => {
        // Arrange: pre-populate storage with tokens and roles
        tokenStorage.storeTokens(tokens);
        tokenStorage.storeRoles(roles);

        // Act: invoke logout
        authService.logout();

        // Flush the POST request with an error response
        const req = httpTestingController.expectOne(`${apiBaseUrl}/auth/logout`);
        expect(req.request.method).toBe('POST');
        req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

        // Assert: all storage is cleared regardless of backend error
        expect(tokenStorage.getAccessToken()).toBeNull();
        expect(tokenStorage.getRefreshToken()).toBeNull();
        expect(tokenStorage.getIdToken()).toBeNull();
        expect(tokenStorage.getRoles()).toEqual([]);
        expect(authService.isAuthenticated()).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property-based tests for AuthService.completeSocialLogin.
 * Feature: social-authentication
 */

describe('Feature: social-authentication, Property 3: La finalización exitosa establece un estado de sesión consistente', () => {
  /**
   * **Validates: Requirements 1.4, 1.5, 3.2, 3.7, 7.5, 8.5**
   *
   * For any valid TokenPair (all four fields non-empty) and any list of roles,
   * invoking `completeSocialLogin(tokens, roles)` followed by the post-login
   * navigation cleanup SHALL result in a consistent session state:
   * - The TokenStorageService holds exactly those tokens (key `sora-sport-auth-tokens`)
   *   and those roles (key `sora-sport-auth-roles`).
   * - The `isAuthenticated` signal is true.
   * - The `userRoles` signal equals the roles.
   * - The `isLoading` signal is false.
   * - The stored Return_URL has been removed.
   *
   * Note: `completeSocialLogin` itself is responsible for token/role storage and
   * signals. The Return_URL removal and navigation are performed by the social
   * flow / SocialAuthService after navigation completes; here we exercise the
   * AuthService surface that flow relies on (`clearReturnUrl`) to assert the
   * resulting observable session state is consistent.
   */
  let authService: AuthService;
  let tokenStorage: TokenStorageService;
  let httpTestingController: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const apiBaseUrl = 'http://localhost:8000';
  const TOKENS_KEY = 'sora-sport-auth-tokens';
  const ROLES_KEY = 'sora-sport-auth-roles';

  /** Arbitrary that generates valid TokenPair objects (all four fields non-empty). */
  const validTokenPairArb: fc.Arbitrary<TokenPair> = fc.record({
    access_token: fc.string({ minLength: 1 }),
    id_token: fc.string({ minLength: 1 }),
    refresh_token: fc.string({ minLength: 1 }),
    expires_in: fc.integer({ min: 1 }),
  });

  /** Arbitrary that generates role arrays (possibly empty). */
  const rolesArb: fc.Arbitrary<string[]> = fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 });

  /** Arbitrary for an internal Return_URL to be preserved and later removed. */
  const returnUrlArb: fc.Arbitrary<string> = fc
    .string({ minLength: 0, maxLength: 40 })
    .map((s) => '/' + s.replace(/\s/g, ''));

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
      ],
    });

    authService = TestBed.inject(AuthService);
    tokenStorage = TestBed.inject(TokenStorageService);
    httpTestingController = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('should establish a consistent session state after completeSocialLogin and navigation cleanup', () => {
    fc.assert(
      fc.property(
        validTokenPairArb,
        rolesArb,
        returnUrlArb,
        (tokens: TokenPair, roles: string[], returnUrl: string) => {
          // Arrange: a Return_URL is preserved before the social flow completes.
          authService.storeReturnUrl(returnUrl);

          // Act: finalize the social login, then perform the post-navigation cleanup.
          authService.completeSocialLogin(tokens, roles);
          authService.clearReturnUrl();

          // Assert: storage holds exactly the provided tokens under the tokens key.
          const storedTokensRaw = localStorage.getItem(TOKENS_KEY);
          expect(storedTokensRaw).not.toBeNull();
          expect(JSON.parse(storedTokensRaw as string)).toEqual({
            access_token: tokens.access_token,
            id_token: tokens.id_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
          });

          // Assert: storage holds exactly the provided roles under the roles key.
          const storedRolesRaw = localStorage.getItem(ROLES_KEY);
          expect(storedRolesRaw).not.toBeNull();
          expect(JSON.parse(storedRolesRaw as string)).toEqual(roles);
          expect(tokenStorage.getRoles()).toEqual(roles);

          // Assert: individual token accessors reflect the stored TokenPair.
          expect(tokenStorage.getAccessToken()).toBe(tokens.access_token);
          expect(tokenStorage.getIdToken()).toBe(tokens.id_token);
          expect(tokenStorage.getRefreshToken()).toBe(tokens.refresh_token);

          // Assert: signals are consistent with an authenticated session.
          expect(authService.isAuthenticated()).toBe(true);
          expect(authService.userRoles()).toEqual(roles);
          expect(authService.isLoading()).toBe(false);

          // Assert: the stored Return_URL has been removed after navigation.
          expect(authService.getReturnUrl()).toBeNull();

          // Reset for the next generated example.
          localStorage.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
