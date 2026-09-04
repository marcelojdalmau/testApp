import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, EMPTY, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, finalize } from 'rxjs/operators';

import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';

/** Auth endpoint paths that should NOT have a token attached. */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/confirm-forgot-password',
  '/auth/respond-to-challenge',
  '/auth/refresh',
  '/auth/social/exchange',
];

let isRefreshing = false;
let refreshSubject$ = new Subject<string | null>();

/**
 * Functional HTTP interceptor that:
 * 1. Skips token attachment for auth endpoints.
 * 2. Attaches `Authorization: Bearer <token>` to all other requests.
 * 3. On 401: attempts a single token refresh, retries queued requests.
 * 4. On refresh failure: clears state and navigates to login.
 * 5. If no token exists for a protected request: cancels and navigates to login.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<any> => {
  const tokenStorage = inject(TokenStorageService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Pass through auth endpoints without token
  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  const accessToken = tokenStorage.getAccessToken();

  // No token for a protected request — cancel and redirect to login
  if (!accessToken) {
    router.navigate(['/auth/login']);
    return EMPTY;
  }

  // Attach the token and handle potential 401 responses
  const authReq = addAuthorizationHeader(req, accessToken);

  return next(authReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handle401Error(req, next, authService, tokenStorage, router);
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Checks whether the request URL matches one of the auth endpoints
 * that should be excluded from token attachment.
 */
function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

/**
 * Clones the request with an Authorization Bearer header.
 */
function addAuthorizationHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Handles 401 errors by attempting a single token refresh.
 * Concurrent requests are queued and replayed after refresh completes.
 */
function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  tokenStorage: TokenStorageService,
  router: Router,
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    // Reset the subject so new subscribers wait for the fresh value
    refreshSubject$ = new Subject<string | null>();

    return authService.refreshToken().pipe(
      switchMap((response) => {
        const newToken = response.access_token;
        isRefreshing = false;
        refreshSubject$.next(newToken);
        refreshSubject$.complete();

        // Retry the original request with the new token
        return next(addAuthorizationHeader(req, newToken));
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        refreshSubject$.error(refreshError);

        // AuthService.refreshToken() already clears state on 401,
        // but ensure navigation happens for other refresh failures too
        tokenStorage.clearAll();
        router.navigate(['/auth/login']);

        return throwError(() => refreshError);
      }),
    );
  }

  // Another request came in while refresh is in progress — wait for it
  return refreshSubject$.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((newToken) => next(addAuthorizationHeader(req, newToken))),
  );
}
