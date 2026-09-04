import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';
import { API_BASE_URL } from '../config/api.config';
import { RefreshResponse, TokenPair } from '../models/auth.model';

/**
 * Unit tests for authInterceptor.
 * Feature: social-authentication
 *
 * These cases cover the social token-exchange endpoint, which must be treated
 * as an auth endpoint: no Bearer header attached and no 401 refresh triggered.
 */

const apiBaseUrl = 'http://localhost:8000';
const SOCIAL_EXCHANGE_URL = `${apiBaseUrl}/auth/social/exchange`;

const validTokens: TokenPair = {
  access_token: 'stored-access-token',
  id_token: 'stored-id-token',
  refresh_token: 'stored-refresh-token',
  expires_in: 3600,
};

describe('authInterceptor - /auth/social/exchange', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let routerSpy: jasmine.SpyObj<Router>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    authServiceSpy = jasmine.createSpyObj('AuthService', ['refreshToken']);
    // Should never be invoked for this endpoint, but stub it to be safe.
    authServiceSpy.refreshToken.and.returnValue(
      of({ access_token: 'refreshed', id_token: 'r', expires_in: 1 } as RefreshResponse),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceSpy },
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

  it('should NOT attach an Authorization header even when a token is stored', () => {
    // Arrange: a valid token exists in storage
    tokenStorage.storeTokens(validTokens);

    // Act: perform the social exchange request
    httpClient.post(SOCIAL_EXCHANGE_URL, { provider: 'google' }).subscribe();

    // Assert: outgoing request carries no Authorization header
    const req = httpTestingController.expectOne(SOCIAL_EXCHANGE_URL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should NOT trigger a token refresh when the exchange request returns 401', () => {
    // Arrange: a valid token exists in storage
    tokenStorage.storeTokens(validTokens);

    let errorStatus: number | undefined;

    // Act: the exchange request fails with 401
    httpClient.post(SOCIAL_EXCHANGE_URL, { provider: 'google' }).subscribe({
      next: () => fail('expected the 401 error to propagate'),
      error: (error: HttpErrorResponse) => {
        errorStatus = error.status;
      },
    });

    const req = httpTestingController.expectOne(SOCIAL_EXCHANGE_URL);
    req.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Assert: no refresh was attempted and no /auth/refresh request was issued;
    // the 401 propagates to the caller unchanged.
    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
    httpTestingController.expectNone(`${apiBaseUrl}/auth/refresh`);
    expect(errorStatus).toBe(401);
  });
});
