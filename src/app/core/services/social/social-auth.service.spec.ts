import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import {
  SocialAuthService,
  PROVIDER_TIMEOUT_MS,
  LINK_VERIFICATION_TIMEOUT_MS,
  NAME_CONFIRMATION_TIMEOUT_MS,
} from './social-auth.service';
import { SOCIAL_AUTH_STRATEGY, SocialAuthStrategy } from './social-auth-strategy';
import { AuthService } from '../auth.service';
import { API_BASE_URL } from '../../config/api.config';
import { AuthError, LoginResponse } from '../../models/auth.model';
import { SocialAuthPendingContext } from '../../models/social-auth.model';

/**
 * Unit tests (Jasmine + Karma) for {@link SocialAuthService}.
 * Feature: social-authentication (task 5.9)
 *
 * Cubren el mapeo de errores (`mapError`) según la tabla "Error Handling" del
 * diseño y los edge cases con reloj falso (`fakeAsync`/`tick`): timeout de 30 s
 * del proveedor, expiración de la verificación de vinculación a 300 s, nombre no
 * confirmado a 10 s y cancelación.
 *
 * Los mensajes en español se afirman por su texto exacto (el que produce el
 * servicio), coherente con la tabla de la spec.
 */

// Mensajes en español esperados (deben coincidir con los constantes internos
// del servicio y la tabla "Error Handling" del design.md).
const MSG = {
  provider:
    'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.',
  network: 'Problema de conexión. Volvé a iniciar desde el botón del proveedor.',
  timeout: 'La conexión tardó demasiado. Podés reintentar.',
  emailNotShared:
    'Necesitamos tu correo para crear la cuenta. Compartilo e intentá de nuevo.',
  linkVerificationPending:
    'Para vincular tu cuenta necesitamos verificar tu identidad. Seguí los pasos indicados.',
  linkVerificationExpired:
    'La verificación expiró. Volvé a intentar la vinculación.',
  nameNotConfirmed: 'No pudimos guardar tu nombre; podés completarlo luego.',
  methodConflict:
    'Ese correo ya usa otro método de inicio de sesión. Ingresá con tu método original.',
  extraPermissions: 'No podemos continuar sin otorgar permisos no previstos.',
  generic: 'Ocurrió un error inesperado. Intentá de nuevo.',
} as const;

const API_BASE = 'http://localhost:8000';
const EXCHANGE_URL = `${API_BASE}/auth/social/exchange`;
const REDIRECT_URI = 'http://localhost:8000/auth/callback';
const SOCIAL_PENDING_KEY = 'sora-sport-social-pending';

/** Construye un contexto pendiente válido para sembrar en localStorage. */
function makePendingContext(
  overrides: Partial<SocialAuthPendingContext> = {},
): SocialAuthPendingContext {
  return {
    state: 'valid-state',
    code_verifier: 'verifier-abc',
    provider: 'google',
    return_url: null,
    created_at: Date.now(),
    ...overrides,
  };
}

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let authService: AuthService;
  let httpMock: HttpTestingController;
  let strategySpy: jasmine.SpyObj<SocialAuthStrategy>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();

    strategySpy = jasmine.createSpyObj<SocialAuthStrategy>('SocialAuthStrategy', [
      'authorize',
      'getRedirectUri',
    ]);
    strategySpy.authorize.and.returnValue(
      Promise.resolve({ status: 'success' }),
    );
    strategySpy.getRedirectUri.and.returnValue(REDIRECT_URI);

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        SocialAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SOCIAL_AUTH_STRATEGY, useValue: strategySpy },
        { provide: Router, useValue: routerSpy },
        { provide: API_BASE_URL, useValue: API_BASE },
      ],
    });

    service = TestBed.inject(SocialAuthService);
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // mapError: clasificación directa de fallos
  // ---------------------------------------------------------------------------
  describe('mapError', () => {
    it('mapea el resultado de error del proveedor a 400 con mensaje de proveedor', () => {
      const result = service.mapError({ status: 'error' });

      expect(result).toEqual({
        statusCode: 400,
        message: MSG.provider,
        error: 'provider_error',
      } as AuthError);
    });

    it('mapea un fallo de red (HttpErrorResponse status 0) a 0 con mensaje de conexión', () => {
      const httpError = new HttpErrorResponse({ status: 0 });

      const result = service.mapError(httpError);

      expect(result).toEqual({
        statusCode: 0,
        message: MSG.network,
        error: 'network_error',
      } as AuthError);
    });

    it('mapea un error genérico del backend (5xx) preservando el statusCode', () => {
      const httpError = new HttpErrorResponse({ status: 500, error: {} });

      const result = service.mapError(httpError);

      expect(result).toEqual({
        statusCode: 500,
        message: MSG.generic,
        error: 'backend_error',
      } as AuthError);
    });

    it('mapea 400 email_not_shared (por el campo error del cuerpo) al mensaje de correo', () => {
      const httpError = new HttpErrorResponse({
        status: 400,
        error: { error: 'email_not_shared' },
      });

      const result = service.mapError(httpError);

      expect(result).toEqual({
        statusCode: 400,
        message: MSG.emailNotShared,
        error: 'email_not_shared',
      } as AuthError);
    });

    it('mapea 409 al conflicto de método de autenticación', () => {
      const httpError = new HttpErrorResponse({ status: 409, error: {} });

      const result = service.mapError(httpError);

      expect(result).toEqual({
        statusCode: 409,
        message: MSG.methodConflict,
        error: 'method_conflict',
      } as AuthError);
    });

    it('mapea 202 a verificación de vinculación pendiente', () => {
      const httpError = new HttpErrorResponse({ status: 202, error: {} });

      const result = service.mapError(httpError);

      expect(result).toEqual({
        statusCode: 202,
        message: MSG.linkVerificationPending,
        error: 'link_verification_pending',
      } as AuthError);
    });

    it('mapea 400 extra_permissions (por el campo code del cuerpo) al mensaje de permisos', () => {
      const httpError = new HttpErrorResponse({
        status: 400,
        error: { code: 'extra_permissions' },
      });

      const result = service.mapError(httpError);

      expect(result).toEqual({
        statusCode: 400,
        message: MSG.extraPermissions,
        error: 'extra_permissions',
      } as AuthError);
    });

    it('devuelve null ante cancelación (status "cancelled") sin alterar la sesión', () => {
      // Sesión previa no autenticada.
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();

      const result = service.mapError({ status: 'cancelled' });

      expect(result).toBeNull();
      // No cambia el estado de sesión ni los tokens.
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();
    });

    it('devuelve null ante cancelación por access_denied', () => {
      const result = service.mapError({ error: 'access_denied' });

      expect(result).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // handleCallback: timeout de 30 s con reloj falso
  // ---------------------------------------------------------------------------
  describe('handleCallback timeout de 30 s', () => {
    it('emite el error de timeout, deja isLoading en false y no persiste sesión', fakeAsync(() => {
      // Sembrar un contexto pendiente válido con el mismo state.
      const context = makePendingContext({ state: 'st-1' });
      localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(context));

      let received: AuthError | null | undefined;
      let completed = false;

      service.handleCallback('auth-code', 'st-1').subscribe({
        next: () => {
          completed = true;
        },
        error: (err: AuthError | null) => {
          received = err;
        },
      });

      // Existe una petición pendiente que NO se responde: se deja expirar.
      const req = httpMock.expectOne(EXCHANGE_URL);
      expect(req.request.method).toBe('POST');

      // isLoading debe estar activo mientras el flujo está en curso.
      expect(authService.isLoading()).toBe(true);

      // Avanzar el reloj hasta el timeout del proveedor.
      tick(PROVIDER_TIMEOUT_MS);

      expect(completed).toBe(false);
      expect(received).toEqual({
        statusCode: 0,
        message: MSG.timeout,
        error: 'timeout',
      } as AuthError);

      // Final negativo: isLoading en false, sin sesión ni tokens.
      expect(authService.isLoading()).toBe(false);
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();
      expect(localStorage.getItem(SOCIAL_PENDING_KEY)).toBeNull();

      // El operador `timeout` canceló (unsubscribe) la petición pendiente: ya no
      // es flushable. `httpMock.verify()` en afterEach acepta peticiones
      // canceladas, por lo que no hace falta responderla.
    }));
  });

  // ---------------------------------------------------------------------------
  // startLinkVerificationTimer: expiración a 300 s
  // ---------------------------------------------------------------------------
  describe('startLinkVerificationTimer', () => {
    it('emite AuthError 408 con mensaje de expiración a los 300 s sin establecer sesión', fakeAsync(() => {
      let emitted: AuthError | undefined;

      service.startLinkVerificationTimer().subscribe((err) => {
        emitted = err;
      });

      // Antes de expirar no emite nada.
      tick(LINK_VERIFICATION_TIMEOUT_MS - 1);
      expect(emitted).toBeUndefined();

      // Al expirar emite el AuthError de expiración.
      tick(1);

      expect(emitted).toEqual({
        statusCode: 408,
        message: MSG.linkVerificationExpired,
        error: 'link_verification_expired',
      } as AuthError);

      // No se estableció sesión y el contexto pendiente quedó limpio.
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.isLoading()).toBe(false);
      expect(localStorage.getItem(SOCIAL_PENDING_KEY)).toBeNull();
    }));
  });

  // ---------------------------------------------------------------------------
  // confirmAppleName: confirmación vs expiración a 10 s
  // ---------------------------------------------------------------------------
  describe('confirmAppleName', () => {
    it('resuelve {nameSaved:true, message:null} cuando la confirmación llega antes de 10 s', fakeAsync(() => {
      const nameConfirmed$ = new Subject<void>();
      let result: { nameSaved: boolean; message: string | null } | undefined;

      service.confirmAppleName(nameConfirmed$).subscribe((r) => {
        result = r;
      });

      // La confirmación llega dentro del plazo.
      tick(5000);
      nameConfirmed$.next();
      nameConfirmed$.complete();

      expect(result).toEqual({ nameSaved: true, message: null });

      // Consumir el temporizador restante para no dejar timers pendientes.
      tick(NAME_CONFIRMATION_TIMEOUT_MS);
    }));

    it('resuelve {nameSaved:false, message} cuando expira el plazo de 10 s sin confirmación', fakeAsync(() => {
      const nameConfirmed$ = new Subject<void>();
      let result: { nameSaved: boolean; message: string | null } | undefined;

      service.confirmAppleName(nameConfirmed$).subscribe((r) => {
        result = r;
      });

      // Sin confirmación, avanzar hasta la expiración.
      tick(NAME_CONFIRMATION_TIMEOUT_MS);

      expect(result).toEqual({
        nameSaved: false,
        message: MSG.nameNotConfirmed,
      });
    }));
  });

  // ---------------------------------------------------------------------------
  // Cancelación: no cambia el estado de sesión ni tokens
  // ---------------------------------------------------------------------------
  describe('cancelación', () => {
    it('mapError sobre {status:"cancelled"} devuelve null y no altera isAuthenticated ni tokens', () => {
      // Estado inicial: sin sesión.
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();

      const result = service.mapError({ status: 'cancelled' });

      expect(result).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getAccessToken()).toBeNull();
      expect(authService.userRoles()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // handleCallback éxito (verifica el camino feliz de forma acotada)
  // ---------------------------------------------------------------------------
  describe('handleCallback éxito', () => {
    it('intercambia el code, completa la sesión y navega, dejando isLoading en false', fakeAsync(() => {
      const context = makePendingContext({ state: 'st-ok', return_url: '/feed' });
      localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(context));

      const response: LoginResponse = {
        access_token: 'at',
        id_token: 'it',
        refresh_token: 'rt',
        expires_in: 3600,
        roles: ['user'],
      };

      let emitted: LoginResponse | undefined;
      service.handleCallback('code-ok', 'st-ok').subscribe((r) => {
        emitted = r;
      });

      const req = httpMock.expectOne(EXCHANGE_URL);
      expect(req.request.body).toEqual({
        provider: 'google',
        code: 'code-ok',
        code_verifier: 'verifier-abc',
        redirect_uri: REDIRECT_URI,
      });
      req.flush(response);

      // Resolver la navegación (Promise).
      tick();

      expect(emitted).toEqual(response);
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.isLoading()).toBe(false);
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/feed');
      expect(localStorage.getItem(SOCIAL_PENDING_KEY)).toBeNull();
    }));
  });
});
