import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import * as fc from 'fast-check';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

/**
 * Property-based tests for authGuard.
 * Feature: authentication
 *
 * These tests verify that the auth guard preserves the attempted URL
 * before redirecting unauthenticated users to login.
 */

describe('Feature: authentication, Property 8: Auth guard preserves return URL on redirect', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any URL string attempted by an unauthenticated user, the auth guard
   * SHALL store that URL before redirecting to login, and the stored URL
   * SHALL equal the attempted URL.
   */
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  /** Arbitrary that generates a single URL path segment from URL-safe characters */
  const segmentArb: fc.Arbitrary<string> = fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
    minLength: 1,
    maxLength: 20,
  });

  /** Arbitrary that generates valid URL paths */
  const urlPathArb: fc.Arbitrary<string> = fc
    .array(segmentArb, { minLength: 1, maxLength: 5 })
    .map((segments) => '/' + segments.join('/'));

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'storeReturnUrl']);
    authServiceSpy.isAuthenticated.and.returnValue(false);

    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('should store the attempted URL and redirect to /auth/login for any URL when unauthenticated', () => {
    fc.assert(
      fc.property(urlPathArb, (url: string) => {
        // Arrange
        authServiceSpy.storeReturnUrl.calls.reset();
        routerSpy.navigate.calls.reset();

        const route = {} as ActivatedRouteSnapshot;
        const state = { url } as RouterStateSnapshot;

        // Act
        const result = TestBed.runInInjectionContext(() => authGuard(route, state));

        // Assert: guard returns false
        expect(result).toBe(false);

        // Assert: storeReturnUrl was called with the exact URL
        expect(authServiceSpy.storeReturnUrl).toHaveBeenCalledOnceWith(url);

        // Assert: navigated to login
        expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/auth/login']);
      }),
      { numRuns: 100 },
    );
  });

  it('should return true and not store URL when user is authenticated', () => {
    fc.assert(
      fc.property(urlPathArb, (url: string) => {
        // Arrange: user is authenticated
        authServiceSpy.isAuthenticated.and.returnValue(true);
        authServiceSpy.storeReturnUrl.calls.reset();
        routerSpy.navigate.calls.reset();

        const route = {} as ActivatedRouteSnapshot;
        const state = { url } as RouterStateSnapshot;

        // Act
        const result = TestBed.runInInjectionContext(() => authGuard(route, state));

        // Assert: guard returns true
        expect(result).toBe(true);

        // Assert: storeReturnUrl was NOT called
        expect(authServiceSpy.storeReturnUrl).not.toHaveBeenCalled();

        // Assert: no navigation occurred
        expect(routerSpy.navigate).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});
