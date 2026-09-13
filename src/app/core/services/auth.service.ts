import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, finalize, defer } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly _isAuthenticated = signal<boolean>(this.tokenStorage.getAccessToken() !== null);
  private readonly _userRoles = signal<string[]>(this.tokenStorage.getRoles());
  private readonly _isLoading = signal<boolean>(false);

  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly userRoles = this._userRoles.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this._isLoading.set(true);
    return this.http
      .post<LoginResponse>(`${this.apiBaseUrl}/auth/login`, { email: credentials.email, password: credentials.password })
      .pipe(
        tap((response) => {
          // On a challenge response, persist nothing and let LoginComponent route (Req 3.2, 3.3).
          if (response.challenge) {
            return;
          }
          this.persistSession(response);
        }),
        catchError((error) => this.handleError(error)),
        finalize(() => this._isLoading.set(false)),
      );
  }

  /**
   * Persists tokens, roles, and the default tenant id from a successful login /
   * respond-to-challenge response and marks the session authenticated.
   *
   * Persistence is partial-success tolerant (Req 2.3): each stored value is written
   * independently in its own try/catch so that a single storage-write failure neither
   * aborts the remaining writes nor turns a successful 200 response into a failure.
   * The authenticated state is set regardless of individual storage outcomes.
   */
  private persistSession(response: LoginResponse): void {
    this.safeStore(() =>
      this.tokenStorage.storeTokens({
        access_token: response.access_token,
        id_token: response.id_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
      }),
    );
    this.safeStore(() => this.tokenStorage.storeRoles(response.roles));
    if (response.default_tenant_id) {
      this.safeStore(() => this.tokenStorage.storeDefaultTenantId(response.default_tenant_id));
    }

    this._isAuthenticated.set(true);
    this._userRoles.set(response.roles);
  }

  /** Runs a single storage write, swallowing any failure so other writes can proceed (Req 2.3). */
  private safeStore(write: () => void): void {
    try {
      write();
    } catch {
      // A single storage-write failure must not abort the other writes nor fail the login.
    }
  }

  register(data: RegisterRequest): Observable<RegisterResponse> {
    this._isLoading.set(true);
    // Include `account_type` only when a non-empty value is provided (Req 5.9).
    const body = {
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      tenant_id: data.tenant_id,
      ...(data.account_type ? { account_type: data.account_type } : {}),
    };
    return this.http.post<RegisterResponse>(`${this.apiBaseUrl}/auth/register`, body).pipe(
      catchError((error) => this.handleError(error)),
      finalize(() => this._isLoading.set(false)),
    );
  }

  forgotPassword(email: string): Observable<void> {
    this._isLoading.set(true);
    return this.http.post<void>(`${this.apiBaseUrl}/auth/forgot-password`, { email }).pipe(
      catchError((error) => this.handleError(error)),
      finalize(() => this._isLoading.set(false)),
    );
  }

  confirmForgotPassword(data: ConfirmForgotPasswordRequest): Observable<void> {
    this._isLoading.set(true);
    return this.http.post<void>(`${this.apiBaseUrl}/auth/confirm-forgot-password`, data).pipe(
      catchError((error) => this.handleError(error)),
      finalize(() => this._isLoading.set(false)),
    );
  }

  respondToChallenge(data: ChallengeResponse): Observable<LoginResponse> {
    this._isLoading.set(true);
    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/auth/respond-to-challenge`, data).pipe(
      tap((response) => {
        // A successful challenge response is LoginResponse-shaped, so reuse the shared,
        // partial-success-tolerant persistence helper. It persists tokens + roles and the
        // default_tenant_id (when present) and sets isAuthenticated true (Req 13.6, 13.7).
        this.persistSession(response);
      }),
      catchError((error) => this.handleError(error)),
      finalize(() => this._isLoading.set(false)),
    );
  }

  /**
   * Coordina el signal `isLoading` desde flujos externos que abarcan más de una
   * llamada HTTP (p. ej. el flujo social completo en `SocialAuthService`).
   *
   * `login()`, `register()` y demás métodos internos siguen gestionando su
   * propio ciclo de carga; este setter público sólo expone la primitiva para
   * que un orquestador externo pueda reflejar un flujo de larga duración.
   */
  setLoading(value: boolean): void {
    this._isLoading.set(value);
  }

  completeSocialLogin(tokens: TokenPair, roles: string[]): void {
    const isValidTokenPair =
      !!tokens &&
      !!tokens.access_token &&
      !!tokens.id_token &&
      !!tokens.refresh_token &&
      !!tokens.expires_in;

    if (!isValidTokenPair) {
      this._isAuthenticated.set(false);
      return;
    }

    this.tokenStorage.storeTokens({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    });
    this.tokenStorage.storeRoles(roles);
    this._isAuthenticated.set(true);
    this._userRoles.set(roles);
  }

  refreshToken(): Observable<RefreshResponse> {
    const refreshToken = this.tokenStorage.getRefreshToken();

    // Guard: with no stored refresh token, treat as an auth failure and route to login
    // without issuing an HTTP call carrying a null token (Req 8.5).
    if (!refreshToken) {
      this.clearState();
      return throwError(
        () =>
          ({
            statusCode: 401,
            message: 'Your session has expired. Please sign in again.',
          }) as AuthError,
      );
    }

    return this.http.post<RefreshResponse>(`${this.apiBaseUrl}/auth/refresh`, { refresh_token: refreshToken }).pipe(
      tap((response) => {
        // Update the rotating tokens; retain the existing refresh token (Req 8.2, 8.3).
        this.tokenStorage.storeTokens({
          access_token: response.access_token,
          id_token: response.id_token,
          refresh_token: refreshToken,
          expires_in: response.expires_in,
        });
      }),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearState();
        }
        return this.handleError(error);
      }),
    );
  }

  logout(): void {
    const accessToken = this.tokenStorage.getAccessToken();
    // `defer` builds the request lazily on subscribe, so a synchronous send failure
    // (the POST never leaving the client) surfaces as an error notification and still
    // flows through `finalize` — clearing local state and routing to login (Req 9.4).
    defer(() => this.http.post<void>(`${this.apiBaseUrl}/auth/logout`, { access_token: accessToken }))
      .pipe(
        // Clearing runs on every terminal outcome: 204 success or any error (Req 9.2, 9.3, 9.5).
        finalize(() => {
          this.clearState();
        }),
      )
      .subscribe({
        error: () => {
          // Logout clears state regardless of backend response.
        },
      });
  }

  getAccessToken(): string | null {
    return this.tokenStorage.getAccessToken();
  }

  getReturnUrl(): string | null {
    return this.tokenStorage.getReturnUrl();
  }

  clearReturnUrl(): void {
    this.tokenStorage.clearReturnUrl();
  }

  storeReturnUrl(url: string): void {
    this.tokenStorage.storeReturnUrl(url);
  }

  // --- Backward-compatible stubs for legacy components (to be removed in tasks 5.x) ---
  /**
   * Returns the active demo user profile, or `null` when none is selected.
   *
   * While the app migrates from this stub to token-based identity, the demo user
   * switcher persists the chosen profile (see `switchUser`) so components that still
   * read `currentUser()` (`FeedComponent`, `ProfileViewComponent`, `CommunicationComponent`)
   * reflect the selected user instead of always falling back to `MOCK_ATHLETES[0]`.
   */
  currentUser(): any {
    return this.tokenStorage.getDemoUser();
  }

  /**
   * Switches the active session to a demo user profile.
   *
   * There is no real auth token in demo mode, so this persists the full profile plus its
   * `role` into storage/signals that the rest of the app reads: `currentUser()` returns
   * the stored profile, `CurrentUserService.userId`/`role` resolve from it, and the role
   * guards route accordingly. Marking the session as authenticated keeps `authGuard`
   * satisfied while browsing as the demo user.
   */
  switchUser(profile: { role?: string; id?: string } | null | undefined): void {
    const role = profile?.role;
    const roles = role ? [role] : [];

    if (profile) {
      this.tokenStorage.storeDemoUser(profile);
    } else {
      this.tokenStorage.clearDemoUser();
    }

    this.tokenStorage.storeRoles(roles);
    this._userRoles.set(roles);
    this._isAuthenticated.set(true);
  }

  /** @deprecated Legacy stub — will be removed when components are rewritten */
  getTempRegistration(): any {
    return null;
  }

  /** @deprecated Legacy stub — will be removed when components are rewritten */
  completeProfile(_profile: any): void {}
  // --- End backward-compatible stubs ---

  private clearState(): void {
    this.tokenStorage.clearAll();
    this._isAuthenticated.set(false);
    this._userRoles.set([]);
    this.router.navigate(['/auth/login']);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 0) {
      return throwError(
        () =>
          ({
            statusCode: 0,
            message: 'Unable to connect. Check your internet connection.',
          }) as AuthError,
      );
    }

    // Attempt extraction from the Error_Body `error` field (Req 7.1).
    // A body may be present but malformed/corrupted (e.g. a string, a number,
    // or an object whose `error` is not a readable string); guard the read so a
    // failed extraction falls through to the generic fallback rather than throwing.
    let backendMessage: string | undefined;
    try {
      backendMessage = typeof error.error?.error === 'string' ? error.error.error : undefined;
    } catch {
      backendMessage = undefined;
    }

    return throwError(
      () =>
        ({
          statusCode: error.status,
          message: backendMessage ?? 'An unexpected error occurred. Please try again.',
          error: backendMessage,
        }) as AuthError,
    );
  }
}
