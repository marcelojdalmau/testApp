import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import * as fc from 'fast-check';

import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from '../services/token-storage.service';
import { API_BASE_URL } from '../config/api.config';
import { TokenPair } from '../models/auth.model';

/**
 * Property-based tests for authInterceptor.
 * Feature: authentication
 *
 * These tests verify that the interceptor correctly classifies requests
 * as auth vs non-auth endpoints and handles token attachment accordingly.
 */

const AUTH_ENDPOINT_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/confirm-forgot-password',
  '/auth/respond-to-challenge',
  '/auth/refresh',
];

const apiBaseUrl = 'http://localhost:8000';

describe('Feature: authentication, Property 5: Auth interceptor skips auth endpoints', () => {
  /**
   * **Validates: Requirements 6.6**
   *
   * For any HTTP request whose URL path starts with one of the auth endpoint paths
   * (`/auth/login`, `/auth/register`, `/auth/forgot-password`,
   * `/auth/confirm-forgot-password`, `/auth/respond-to-challenge`, `/auth/refresh`),
   * the interceptor SHALL NOT attach an Authorization header.
   */
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let routerSpy: jasmine.SpyObj<Router>;

  /** Arbitrary that generates an auth endpoint URL with optional query params */
  const authEndpointUrlArb: fc.Arbitrary<string> = fc.tuple(
    fc.constantFrom(...AUTH_ENDPOINT_PATHS),
    fc.option(
      fc.webQueryParameters().filter((q) => q.length > 0),
      { nil: undefined },
    ),
  ).map(([path, query]) => {
    const url = `${apiBaseUrl}${path}`;
    return query ? `${url}?${query}` : url;
  });

  /** Arbitrary that generates a valid token to pre-store */
  const tokenPairArb: fc.Arbitrary<TokenPair> = fc.record({
    access_token: fc.string({ minLength: 1 }),
    id_token: fc.string({ minLength: 1 }),
    refresh_token: fc.string({ minLength: 1 }),
    expires_in: fc.integer({ min: 1 }),
  });

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('should NOT attach Authorization header for auth endpoint requests even when token exists', () => {
    fc.assert(
      fc.property(authEndpointUrlArb, tokenPairArb, (url: string, tokens: TokenPair) => {
        // Arrange: store a token so the interceptor has one available
        tokenStorage.storeTokens(tokens);

        // Act: make a request to an auth endpoint
        httpClient.post(url, {}).subscribe();

        // Assert: the outgoing request should NOT have an Authorization header
        const req = httpTestingController.expectOne(url);
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: authentication, Property 6: Auth interceptor attaches token to non-auth requests', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * For any HTTP request whose URL path does NOT start with an auth endpoint path,
   * and when a valid access_token exists in storage, the interceptor SHALL attach
   * `Authorization: Bearer <token>` header.
   */
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let routerSpy: jasmine.SpyObj<Router>;

  /**
   * Arbitrary that generates a non-auth URL path.
   * We ensure the path does NOT contain any of the auth endpoint substrings.
   */
  const nonAuthPathArb: fc.Arbitrary<string> = fc
    .stringMatching(/^\/[a-z][a-z0-9\-\/]{0,30}$/)
    .filter((path) => AUTH_ENDPOINT_PATHS.every((authPath) => !path.includes(authPath)));

  /** Arbitrary that generates a valid token to pre-store */
  const tokenPairArb: fc.Arbitrary<TokenPair> = fc.record({
    access_token: fc.stringMatching(/^[A-Za-z0-9._\-]{10,50}$/),
    id_token: fc.string({ minLength: 1 }),
    refresh_token: fc.string({ minLength: 1 }),
    expires_in: fc.integer({ min: 1 }),
  });

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('should attach Authorization: Bearer <token> header for non-auth endpoint requests', () => {
    fc.assert(
      fc.property(nonAuthPathArb, tokenPairArb, (path: string, tokens: TokenPair) => {
        // Arrange: store tokens
        tokenStorage.storeTokens(tokens);
        const fullUrl = `${apiBaseUrl}${path}`;

        // Act: make a request to a non-auth endpoint
        httpClient.get(fullUrl).subscribe();

        // Assert: the outgoing request should have the Authorization header with Bearer token
        const req = httpTestingController.expectOne(fullUrl);
        expect(req.request.headers.has('Authorization')).toBe(true);
        expect(req.request.headers.get('Authorization')).toBe(`Bearer ${tokens.access_token}`);
        req.flush({});
      }),
      { numRuns: 100 },
    );
  });
});
