import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { API_BASE_URL, DEFAULT_TENANT_ID } from '../config/api.config';
import { RegisterRequest, RegisterResponse } from '../models/auth.model';

/**
 * Property-based test for the register request body.
 * Feature: register-reform, Property 1: El cuerpo de registro contiene exactamente el conjunto permitido
 *
 * Para todo par (email, password) no vacío, el cuerpo que `AuthService.register()`
 * envía al Register_Endpoint contiene exactamente las claves `email` y `password`
 * cuando `DEFAULT_TENANT_ID` es `null`, y exactamente `email`, `password`, `tenant_id`
 * cuando `DEFAULT_TENANT_ID` provee un valor no vacío; nunca contiene `full_name`,
 * `account_type` ni ningún otro campo de perfil.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6
 */

describe('Feature: register-reform, Property 1: El cuerpo de registro contiene exactamente el conjunto permitido', () => {
  const apiBase = 'http://test-api.example.com';

  const mockRegisterResponse: RegisterResponse = {
    user_id: 'user-001',
    email: 'test@example.com',
    full_name: '',
    status: 'pending_confirmation',
    message: 'ok',
  };

  /** Non-empty email-like string. */
  const emailArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 254 });

  /** Non-empty password string (8..72 as per the domain, but any non-empty works for the body contract). */
  const passwordArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 72 });

  /** A (email, password) pair. */
  const credsArb: fc.Arbitrary<RegisterRequest> = fc.record({
    email: emailArb,
    password: passwordArb,
  });

  /**
   * Configure a fresh TestBed with the given DEFAULT_TENANT_ID override and return
   * the wired AuthService + HttpTestingController.
   */
  const setup = (tenantId: string | null) => {
    TestBed.resetTestingModule();
    localStorage.clear();
    const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        TokenStorageService,
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: apiBase },
        { provide: DEFAULT_TENANT_ID, useValue: tenantId },
      ],
    });
    const service = TestBed.inject(AuthService);
    const httpTesting = TestBed.inject(HttpTestingController);
    return { service, httpTesting };
  };

  it('sends exactly {email, password} when DEFAULT_TENANT_ID is null', () => {
    fc.assert(
      fc.property(credsArb, (creds) => {
        const { service, httpTesting } = setup(null);

        service.register(creds).subscribe();

        const req = httpTesting.expectOne(`${apiBase}/auth/register`);
        expect(req.request.method).toBe('POST');

        const body = req.request.body as Record<string, unknown>;
        // Exact key set: nothing more, nothing less.
        expect(Object.keys(body).sort()).toEqual(['email', 'password']);
        expect(body['email']).toBe(creds.email);
        expect(body['password']).toBe(creds.password);
        // Never any profile field.
        expect('tenant_id' in body).toBeFalse();
        expect('full_name' in body).toBeFalse();
        expect('account_type' in body).toBeFalse();

        req.flush(mockRegisterResponse, { status: 201, statusText: 'Created' });
        httpTesting.verify();
      }),
      { numRuns: 100 },
    );
  });

  it('sends exactly {email, password, tenant_id} when DEFAULT_TENANT_ID has a non-empty value', () => {
    fc.assert(
      fc.property(
        credsArb,
        fc.string({ minLength: 1, maxLength: 40 }),
        (creds, tenantId) => {
          const { service, httpTesting } = setup(tenantId);

          service.register(creds).subscribe();

          const req = httpTesting.expectOne(`${apiBase}/auth/register`);
          const body = req.request.body as Record<string, unknown>;
          // Exact key set includes tenant_id and nothing else.
          expect(Object.keys(body).sort()).toEqual(['email', 'password', 'tenant_id']);
          expect(body['email']).toBe(creds.email);
          expect(body['password']).toBe(creds.password);
          expect(body['tenant_id']).toBe(tenantId);
          // Never any other profile field.
          expect('full_name' in body).toBeFalse();
          expect('account_type' in body).toBeFalse();

          req.flush(mockRegisterResponse, { status: 201, statusText: 'Created' });
          httpTesting.verify();
        },
      ),
      { numRuns: 100 },
    );
  });
});
