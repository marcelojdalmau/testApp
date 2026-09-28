import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { API_BASE_URL } from '../config/api.config';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ConfirmForgotPasswordRequest,
  ChallengeResponse,
  RefreshResponse,
  AuthError,
  TokenPair,
} from '../models/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  let tokenStorage: TokenStorageService;
  let router: jasmine.SpyObj<Router>;

  const apiBase = 'http://test-api.example.com';

  const mockLoginResponse: LoginResponse = {
    access_token: 'access-123',
    id_token: 'id-456',
    refresh_token: 'refresh-789',
    expires_in: 3600,
    default_tenant_id: 'tenant-123',
    roles: ['player', 'coach'],
  };

  const mockChallengeResponse: LoginResponse = {
    access_token: '',
    id_token: '',
    refresh_token: '',
    expires_in: 0,
    default_tenant_id: '',
    roles: [],
    challenge: 'NEW_PASSWORD_REQUIRED',
    session: 'session-abc',
  };

  const mockRegisterResponse: RegisterResponse = {
    user_id: 'user-001',
    email: 'test@example.com',
    full_name: 'Test User',
    status: 'pending_confirmation',
    message: 'Please check your email for verification.',
  };

  const mockRefreshResponse: RefreshResponse = {
    access_token: 'new-access-456',
    id_token: 'new-id-789',
    expires_in: 3600,
  };

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        TokenStorageService,
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBase },
      ],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    localStorage.clear();
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should set isAuthenticated to false when no tokens exist', () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should set userRoles to empty array when no roles stored', () => {
      expect(service.userRoles()).toEqual([]);
    });

    it('should set isLoading to false initially', () => {
      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('login()', () => {
    const credentials: LoginRequest = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('should POST to /auth/login with credentials', () => {
      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(mockLoginResponse);
    });

    it('should store tokens on successful login', () => {
      spyOn(tokenStorage, 'storeTokens').and.callThrough();

      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockLoginResponse);

      expect(tokenStorage.storeTokens).toHaveBeenCalledWith({
        access_token: 'access-123',
        id_token: 'id-456',
        refresh_token: 'refresh-789',
        expires_in: 3600,
      });
    });

    it('should store roles on successful login', () => {
      spyOn(tokenStorage, 'storeRoles').and.callThrough();

      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockLoginResponse);

      expect(tokenStorage.storeRoles).toHaveBeenCalledWith(['player', 'coach']);
    });

    it('should set isAuthenticated to true on successful login', () => {
      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should set userRoles on successful login', () => {
      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockLoginResponse);

      expect(service.userRoles()).toEqual(['player', 'coach']);
    });

    it('should NOT store tokens when challenge is returned', () => {
      spyOn(tokenStorage, 'storeTokens');

      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockChallengeResponse);

      expect(tokenStorage.storeTokens).not.toHaveBeenCalled();
    });

    it('should NOT set isAuthenticated when challenge is returned', () => {
      service.login(credentials).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockChallengeResponse);

      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should return challenge response for NEW_PASSWORD_REQUIRED', () => {
      let response: LoginResponse | undefined;
      service.login(credentials).subscribe((r) => (response = r));

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockChallengeResponse);

      expect(response?.challenge).toBe('NEW_PASSWORD_REQUIRED');
      expect(response?.session).toBe('session-abc');
    });

    it('should throw AuthError with message on 401', () => {
      let error: AuthError | undefined;

      service.login(credentials).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(401);
      expect(error!.message).toBe('Invalid credentials');
    });

    it('should throw AuthError with message on 403', () => {
      let error: AuthError | undefined;

      service.login(credentials).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush({ message: 'Account is not active' }, { status: 403, statusText: 'Forbidden' });

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(403);
      expect(error!.message).toBe('Account is not active');
    });

    it('should set isLoading to true during request', () => {
      service.login(credentials).subscribe();
      expect(service.isLoading()).toBeTrue();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(mockLoginResponse);

      expect(service.isLoading()).toBeFalse();
    });

    it('should set isLoading to false after error', () => {
      service.login(credentials).subscribe({ error: () => {} });
      expect(service.isLoading()).toBeTrue();

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      expect(service.isLoading()).toBeFalse();
    });

    it('should map network error (status 0) to connection message', () => {
      let error: AuthError | undefined;

      service.login(credentials).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: '' });

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(0);
      expect(error!.message).toBe('Unable to connect. Check your internet connection.');
    });
  });

  describe('register()', () => {
    const registerData: RegisterRequest = {
      email: 'new@example.com',
      password: 'secure123',
    };

    it('should POST to /auth/register with data', () => {
      service.register(registerData).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(registerData);
      req.flush(mockRegisterResponse, { status: 201, statusText: 'Created' });
    });

    it('should return RegisterResponse on success', () => {
      let response: RegisterResponse | undefined;

      service.register(registerData).subscribe((r) => (response = r));

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      req.flush(mockRegisterResponse, { status: 201, statusText: 'Created' });

      expect(response).toEqual(mockRegisterResponse);
    });

    it('should throw AuthError on 409 conflict', () => {
      let error: AuthError | undefined;

      service.register(registerData).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      req.flush(
        { message: 'Email is already registered' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(409);
      expect(error!.message).toBe('Email is already registered');
    });

    it('should throw AuthError on 403 forbidden', () => {
      let error: AuthError | undefined;

      service.register(registerData).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      req.flush(
        { message: 'Self-registration is not allowed for this institution' },
        { status: 403, statusText: 'Forbidden' },
      );

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(403);
      expect(error!.message).toBe('Self-registration is not allowed for this institution');
    });

    it('should throw AuthError on 404 not found', () => {
      let error: AuthError | undefined;

      service.register(registerData).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      req.flush(
        { message: 'Institution not found' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(404);
      expect(error!.message).toBe('Institution not found');
    });

    it('should throw AuthError with backend message on 400', () => {
      let error: AuthError | undefined;

      service.register(registerData).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      req.flush(
        { message: 'Password does not meet requirements' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(400);
      expect(error!.message).toBe('Password does not meet requirements');
    });

    it('should set isLoading during request', () => {
      service.register(registerData).subscribe();
      expect(service.isLoading()).toBeTrue();

      const req = httpTesting.expectOne(`${apiBase}/auth/register`);
      req.flush(mockRegisterResponse, { status: 201, statusText: 'Created' });

      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('forgotPassword()', () => {
    it('should POST to /auth/forgot-password with email', () => {
      service.forgotPassword('user@example.com').subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush(null);
    });

    it('should set isLoading during request', () => {
      service.forgotPassword('user@example.com').subscribe();
      expect(service.isLoading()).toBeTrue();

      const req = httpTesting.expectOne(`${apiBase}/auth/forgot-password`);
      req.flush(null);

      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('confirmForgotPassword()', () => {
    const confirmData: ConfirmForgotPasswordRequest = {
      email: 'user@example.com',
      code: '123456',
      new_password: 'newPassword1',
    };

    it('should POST to /auth/confirm-forgot-password with data', () => {
      service.confirmForgotPassword(confirmData).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/confirm-forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(confirmData);
      req.flush(null);
    });

    it('should set isLoading during request', () => {
      service.confirmForgotPassword(confirmData).subscribe();
      expect(service.isLoading()).toBeTrue();

      const req = httpTesting.expectOne(`${apiBase}/auth/confirm-forgot-password`);
      req.flush(null);

      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('respondToChallenge()', () => {
    const challengeData: ChallengeResponse = {
      session: 'session-abc',
      email: 'user@example.com',
      new_password: 'newPassword1',
    };

    it('should POST to /auth/respond-to-challenge with data', () => {
      service.respondToChallenge(challengeData).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/respond-to-challenge`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(challengeData);
      req.flush(mockLoginResponse);
    });

    it('should store tokens and roles on successful challenge response', () => {
      spyOn(tokenStorage, 'storeTokens').and.callThrough();
      spyOn(tokenStorage, 'storeRoles').and.callThrough();

      service.respondToChallenge(challengeData).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/respond-to-challenge`);
      req.flush(mockLoginResponse);

      expect(tokenStorage.storeTokens).toHaveBeenCalledWith({
        access_token: 'access-123',
        id_token: 'id-456',
        refresh_token: 'refresh-789',
        expires_in: 3600,
      });
      expect(tokenStorage.storeRoles).toHaveBeenCalledWith(['player', 'coach']);
    });

    it('should set isAuthenticated to true on challenge success', () => {
      service.respondToChallenge(challengeData).subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/respond-to-challenge`);
      req.flush(mockLoginResponse);

      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should set isLoading during request', () => {
      service.respondToChallenge(challengeData).subscribe();
      expect(service.isLoading()).toBeTrue();

      const req = httpTesting.expectOne(`${apiBase}/auth/respond-to-challenge`);
      req.flush(mockLoginResponse);

      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('completeSocialLogin()', () => {
    const validTokens: TokenPair = {
      access_token: 'social-access-123',
      id_token: 'social-id-456',
      refresh_token: 'social-refresh-789',
      expires_in: 3600,
    };
    const roles = ['player', 'coach'];

    it('should store tokens on success', () => {
      spyOn(tokenStorage, 'storeTokens').and.callThrough();

      service.completeSocialLogin(validTokens, roles);

      expect(tokenStorage.storeTokens).toHaveBeenCalledWith({
        access_token: 'social-access-123',
        id_token: 'social-id-456',
        refresh_token: 'social-refresh-789',
        expires_in: 3600,
      });
    });

    it('should store roles on success', () => {
      spyOn(tokenStorage, 'storeRoles').and.callThrough();

      service.completeSocialLogin(validTokens, roles);

      expect(tokenStorage.storeRoles).toHaveBeenCalledWith(['player', 'coach']);
    });

    it('should persist tokens retrievable from storage on success', () => {
      service.completeSocialLogin(validTokens, roles);

      expect(tokenStorage.getAccessToken()).toBe('social-access-123');
      expect(tokenStorage.getIdToken()).toBe('social-id-456');
      expect(tokenStorage.getRefreshToken()).toBe('social-refresh-789');
      expect(tokenStorage.getRoles()).toEqual(['player', 'coach']);
    });

    it('should set isAuthenticated to true on success', () => {
      service.completeSocialLogin(validTokens, roles);

      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should set userRoles to the returned roles on success', () => {
      service.completeSocialLogin(validTokens, roles);

      expect(service.userRoles()).toEqual(['player', 'coach']);
    });

    it('should set empty userRoles when roles array is empty on success', () => {
      service.completeSocialLogin(validTokens, []);

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.userRoles()).toEqual([]);
    });

    it('should NOT store tokens when access_token is missing', () => {
      spyOn(tokenStorage, 'storeTokens');
      spyOn(tokenStorage, 'storeRoles');

      service.completeSocialLogin({ ...validTokens, access_token: '' }, roles);

      expect(tokenStorage.storeTokens).not.toHaveBeenCalled();
      expect(tokenStorage.storeRoles).not.toHaveBeenCalled();
    });

    it('should NOT store tokens when id_token is missing', () => {
      spyOn(tokenStorage, 'storeTokens');

      service.completeSocialLogin({ ...validTokens, id_token: '' }, roles);

      expect(tokenStorage.storeTokens).not.toHaveBeenCalled();
    });

    it('should NOT store tokens when refresh_token is missing', () => {
      spyOn(tokenStorage, 'storeTokens');

      service.completeSocialLogin({ ...validTokens, refresh_token: '' }, roles);

      expect(tokenStorage.storeTokens).not.toHaveBeenCalled();
    });

    it('should NOT store tokens when expires_in is missing', () => {
      spyOn(tokenStorage, 'storeTokens');

      service.completeSocialLogin({ ...validTokens, expires_in: 0 }, roles);

      expect(tokenStorage.storeTokens).not.toHaveBeenCalled();
    });

    it('should keep isAuthenticated false when TokenPair is incomplete', () => {
      service.completeSocialLogin({ ...validTokens, access_token: '' }, roles);

      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should NOT set userRoles when TokenPair is incomplete', () => {
      service.completeSocialLogin({ ...validTokens, refresh_token: '' }, roles);

      expect(service.userRoles()).toEqual([]);
    });

    it('should discard partial data and not persist anything when TokenPair is incomplete', () => {
      service.completeSocialLogin({ ...validTokens, id_token: '' }, roles);

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRefreshToken()).toBeNull();
      expect(tokenStorage.getRoles()).toEqual([]);
    });
  });

  describe('refreshToken()', () => {
    beforeEach(() => {
      tokenStorage.storeTokens({
        access_token: 'old-access',
        id_token: 'old-id',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
      });
    });

    it('should POST to /auth/refresh with stored refresh token', () => {
      service.refreshToken().subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refresh_token: 'refresh-token-123' });
      req.flush(mockRefreshResponse);
    });

    it('should update stored tokens on success', () => {
      service.refreshToken().subscribe();

      const req = httpTesting.expectOne(`${apiBase}/auth/refresh`);
      req.flush(mockRefreshResponse);

      expect(tokenStorage.getAccessToken()).toBe('new-access-456');
      expect(tokenStorage.getIdToken()).toBe('new-id-789');
      // Refresh token stays the same
      expect(tokenStorage.getRefreshToken()).toBe('refresh-token-123');
    });

    it('should clear all state and navigate to login on 401', () => {
      spyOn(tokenStorage, 'clearAll').and.callThrough();

      service.refreshToken().subscribe({ error: () => {} });

      const req = httpTesting.expectOne(`${apiBase}/auth/refresh`);
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(tokenStorage.clearAll).toHaveBeenCalled();
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.userRoles()).toEqual([]);
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('logout()', () => {
    beforeEach(() => {
      tokenStorage.storeTokens({
        access_token: 'current-access',
        id_token: 'current-id',
        refresh_token: 'current-refresh',
        expires_in: 3600,
      });
      tokenStorage.storeRoles(['admin']);
    });

    it('should POST to /auth/logout with access token', () => {
      service.logout();

      const req = httpTesting.expectOne(`${apiBase}/auth/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ access_token: 'current-access' });
      req.flush(null);
    });

    it('should clear all stored state after successful logout', fakeAsync(() => {
      service.logout();

      const req = httpTesting.expectOne(`${apiBase}/auth/logout`);
      req.flush(null);
      tick();

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRefreshToken()).toBeNull();
      expect(tokenStorage.getIdToken()).toBeNull();
      expect(tokenStorage.getRoles()).toEqual([]);
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.userRoles()).toEqual([]);
    }));

    it('should navigate to /auth/login after logout', fakeAsync(() => {
      service.logout();

      const req = httpTesting.expectOne(`${apiBase}/auth/logout`);
      req.flush(null);
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));

    it('should clear state even if backend returns error', fakeAsync(() => {
      service.logout();

      const req = httpTesting.expectOne(`${apiBase}/auth/logout`);
      req.flush({}, { status: 500, statusText: 'Server Error' });
      tick();

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRoles()).toEqual([]);
      expect(service.isAuthenticated()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));

    it('should clear state even on network error', fakeAsync(() => {
      service.logout();

      const req = httpTesting.expectOne(`${apiBase}/auth/logout`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: '' });
      tick();

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    }));
  });

  describe('error mapping', () => {
    const credentials: LoginRequest = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('should map unknown errors to generic message', () => {
      let error: AuthError | undefined;

      service.login(credentials).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(500);
      expect(error!.message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should use detail field when message is not available', () => {
      let error: AuthError | undefined;

      service.login(credentials).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(
        { detail: 'Detailed error from backend' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      expect(error).toBeDefined();
      expect(error!.message).toBe('Detailed error from backend');
    });

    it('should include error field from backend response', () => {
      let error: AuthError | undefined;

      service.login(credentials).subscribe({
        error: (e) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/auth/login`);
      req.flush(
        { message: 'Invalid credentials', error: 'INVALID_CREDENTIALS' },
        { status: 401, statusText: 'Unauthorized' },
      );

      expect(error).toBeDefined();
      expect(error!.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('state helpers', () => {
    it('should return access token from storage', () => {
      tokenStorage.storeTokens({
        access_token: 'my-token',
        id_token: 'id-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
      });

      expect(service.getAccessToken()).toBe('my-token');
    });

    it('should return null when no access token', () => {
      expect(service.getAccessToken()).toBeNull();
    });

    it('should store and retrieve return URL', () => {
      service.storeReturnUrl('/dashboard/settings');
      expect(service.getReturnUrl()).toBe('/dashboard/settings');
    });

    it('should clear return URL', () => {
      service.storeReturnUrl('/dashboard');
      service.clearReturnUrl();
      expect(service.getReturnUrl()).toBeNull();
    });
  });
});
