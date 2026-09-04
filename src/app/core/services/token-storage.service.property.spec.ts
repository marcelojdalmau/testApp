import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';
import { TokenStorageService } from './token-storage.service';
import { TokenPair } from '../models/auth.model';

/**
 * Property-based tests for TokenStorageService.
 * Feature: authentication
 *
 * These tests verify the round-trip storage/retrieval property holds
 * across all valid TokenPair inputs using fast-check.
 */

describe('Feature: authentication, Property 4: Token storage round-trip', () => {
  /**
   * **Validates: Requirements 1.2, 6.2**
   *
   * For any valid TokenPair object, storing it via `TokenStorageService.storeTokens()`
   * and then retrieving via `getAccessToken()`, `getRefreshToken()`, and `getIdToken()`
   * SHALL return the original token values.
   */
  let service: TokenStorageService;

  /** Arbitrary that generates valid TokenPair objects */
  const tokenPairArb: fc.Arbitrary<TokenPair> = fc.record({
    access_token: fc.string({ minLength: 1 }),
    id_token: fc.string({ minLength: 1 }),
    refresh_token: fc.string({ minLength: 1 }),
    expires_in: fc.integer({ min: 1 }),
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return original access_token, id_token, and refresh_token after storing', () => {
    fc.assert(
      fc.property(tokenPairArb, (tokens: TokenPair) => {
        service.storeTokens(tokens);

        expect(service.getAccessToken()).toBe(tokens.access_token);
        expect(service.getRefreshToken()).toBe(tokens.refresh_token);
        expect(service.getIdToken()).toBe(tokens.id_token);
      }),
      { numRuns: 100 }
    );
  });

  it('should return null for all getters after clearTokens()', () => {
    fc.assert(
      fc.property(tokenPairArb, (tokens: TokenPair) => {
        service.storeTokens(tokens);
        service.clearTokens();

        expect(service.getAccessToken()).toBeNull();
        expect(service.getRefreshToken()).toBeNull();
        expect(service.getIdToken()).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve the last stored tokens when storeTokens is called multiple times', () => {
    fc.assert(
      fc.property(tokenPairArb, tokenPairArb, (first: TokenPair, second: TokenPair) => {
        service.storeTokens(first);
        service.storeTokens(second);

        expect(service.getAccessToken()).toBe(second.access_token);
        expect(service.getRefreshToken()).toBe(second.refresh_token);
        expect(service.getIdToken()).toBe(second.id_token);
      }),
      { numRuns: 100 }
    );
  });
});
