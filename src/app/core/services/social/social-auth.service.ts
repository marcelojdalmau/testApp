import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  throwError,
  from,
  timer,
  race,
  of,
  TimeoutError,
} from 'rxjs';
import { catchError, switchMap, tap, timeout, map } from 'rxjs/operators';

import { AuthService } from '../auth.service';
import { TokenStorageService } from '../token-storage.service';
import { API_BASE_URL } from '../../config/api.config';
import {
  isInternalReturnUrl,
  resolveReturnUrl,
} from '../../validators/return-url.validator';
import { SOCIAL_AUTH_STRATEGY } from './social-auth-strategy';
import { AuthError, LoginResponse, TokenPair } from '../../models/auth.model';
import {
  SocialAuthorizeResult,
  SocialAuthPendingContext,
  SocialExchangeRequest,
  SocialProvider,
} from '../../models/social-auth.model';

/**
 * Clave de almacenamiento del contexto pendiente del flujo social, persistido
 * entre el inicio del flujo (redirect al proveedor) y el callback de vuelta.
 */
const SOCIAL_PENDING_KEY = 'sora-sport-social-pending';

/**
 * Longitud en bytes del `code_verifier` (PKCE) antes de la codificación
 * base64url. 32 bytes producen un verifier de 43 caracteres, dentro del rango
 * permitido por RFC 7636 (43-128 caracteres).
 */
const PKCE_VERIFIER_BYTES = 32;

/**
 * Longitud en bytes del `state` opaco anti-CSRF antes de la codificación
 * base64url.
 */
const STATE_BYTES = 32;

/**
 * Ruta principal por defecto a la que se navega tras una autenticación social
 * exitosa cuando no hay una `Return_URL` interna válida que restaurar.
 */
const DEFAULT_RETURN_URL = '/feed';

/**
 * Tiempo máximo de espera (ms) del flujo del proveedor (intercambio incluido).
 * Al expirar se cancela el intento y se mapea a un fallo de conexión por
 * timeout (Requisito 5.4). Se expone como constante para que las pruebas con
 * reloj falso puedan referenciar el valor exacto.
 */
export const PROVIDER_TIMEOUT_MS = 30000;

/**
 * Tiempo máximo local (ms) para completar la verificación adicional requerida
 * antes de vincular una identidad social a una cuenta existente. Al expirar se
 * cancela la vinculación, se conserva sin cambios la cuenta existente y se
 * muestra el mensaje de expiración (Requisito 4.4). Constante para pruebas con
 * reloj falso.
 */
export const LINK_VERIFICATION_TIMEOUT_MS = 300000;

/**
 * Tiempo máximo local (ms) que se concede al backend para confirmar la
 * persistencia del nombre compartido por Apple en la primera autenticación. Al
 * expirar, la sesión se completa igualmente (sin el nombre) y se informa que no
 * pudo guardarse (Requisito 6.4). Constante para pruebas con reloj falso.
 */
export const NAME_CONFIRMATION_TIMEOUT_MS = 10000;

/**
 * Mensajes de UI en español mapeados por situación de error, según la tabla
 * "Error Handling" del diseño. Se centralizan aquí para consistencia entre
 * `SocialAuthService` y los componentes que los renderizan.
 */
const SOCIAL_ERROR_MESSAGES = {
  provider:
    'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.',
  network:
    'Problema de conexión. Volvé a iniciar desde el botón del proveedor.',
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

/**
 * Discriminadores del cuerpo de respuesta del backend para desambiguar los
 * distintos sub-casos de `400`. El contrato del backend (design.md "Contrato de
 * dependencia del backend") aún está por coordinar, por lo que estos códigos
 * son una suposición razonable documentada: el frontend inspecciona el campo
 * `error`/`code` del cuerpo del `HttpErrorResponse` para distinguir entre correo
 * no compartido, permisos extra y error genérico del proveedor.
 *
 * ASUNCIÓN: el backend expone un campo `error` o `code` en el cuerpo con uno de
 * estos valores. Si el contrato final difiere, basta actualizar estas
 * constantes sin tocar la lógica de `mapError`.
 */
const BACKEND_ERROR_CODES = {
  emailNotShared: 'email_not_shared',
  extraPermissions: 'extra_permissions',
} as const;

/**
 * Marcador de resultado de timeout. El operador `timeout(...)` (tarea 5.7) puede
 * producir un error con esta forma para que `mapError` lo clasifique como fallo
 * de conexión por tiempo de espera agotado.
 */
export interface SocialTimeoutMarker {
  kind: 'timeout';
}

/**
 * Determina si un valor es el marcador de timeout emitido por el flujo social.
 */
function isTimeoutMarker(value: unknown): value is SocialTimeoutMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'timeout'
  );
}

/**
 * Servicio orquestador de la autenticación social.
 *
 * Genera el par PKCE (`code_verifier`/`code_challenge`) y un `state` aleatorio
 * opaco, persiste el contexto pendiente para recuperarlo tras el redirect, y
 * delega la apertura del flujo del proveedor en la `SocialAuthStrategy`
 * resuelta por plataforma. No manipula directamente el almacenamiento de
 * tokens ni los signals de sesión: la finalización se delega en
 * `AuthService.completeSocialLogin` (tarea 5.5).
 */
@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  private readonly strategy = inject(SOCIAL_AUTH_STRATEGY);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /**
   * Inicia el flujo de autenticación social para el proveedor indicado.
   *
   * Genera PKCE + `state`, persiste el `SocialAuthPendingContext` (incluyendo
   * la `Return_URL` validada como ruta interna), resuelve el `redirect_uri` vía
   * la estrategia de plataforma y delega en `strategy.authorize(...)`.
   */
  async startSocialLogin(provider: SocialProvider): Promise<void> {
    // El flujo social abarca más de una llamada HTTP (redirect + callback +
    // intercambio); se marca isLoading al iniciar y se desactiva en el callback
    // (éxito o error). En Web esta primitiva sobrevive al redirect por señal.
    this.authService.setLoading(true);

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();
    const redirectUri = this.strategy.getRedirectUri();

    // Sólo se preserva la Return_URL si es una ruta interna válida; en cualquier
    // otro caso se guarda null y el destino se resolverá al fallback (/feed).
    const storedReturnUrl = this.authService.getReturnUrl();
    const returnUrl = isInternalReturnUrl(storedReturnUrl)
      ? storedReturnUrl
      : null;

    const context: SocialAuthPendingContext = {
      state,
      code_verifier: codeVerifier,
      provider,
      return_url: returnUrl,
      created_at: Date.now(),
    };
    this.persistPendingContext(context);

    await this.strategy.authorize({
      provider,
      code_challenge: codeChallenge,
      state,
      redirect_uri: redirectUri,
    });
  }

  /**
   * Procesa el callback del proveedor (sólo Web): valida el `state` contra el
   * contexto pendiente, recupera el `code_verifier` y la `Return_URL`, ejecuta
   * el intercambio `POST /auth/social/exchange`, valida que el `TokenPair` esté
   * completo (los 4 campos) y delega la finalización de la sesión en
   * `AuthService.completeSocialLogin`. En éxito, navega a la `Return_URL`
   * validada o a `/feed` y elimina la `Return_URL` almacenada tras completar la
   * navegación.
   *
   * Coordina el signal `isLoading` del `AuthService`: se libera tanto en éxito
   * como en error.
   *
   * @param code El código de autorización devuelto por el proveedor.
   * @param state El `state` opaco devuelto por el proveedor, a validar contra el contexto pendiente.
   * @returns Un `Observable<LoginResponse>` que emite la respuesta del backend en éxito.
   */
  handleCallback(code: string, state: string): Observable<LoginResponse> {
    this.authService.setLoading(true);

    const context = this.readPendingContext();

    // Validación anti-CSRF: el state debe existir y coincidir exactamente con
    // el del contexto pendiente. Cualquier discrepancia aborta el flujo y se
    // trata como un error del proveedor (no se pudo completar la autenticación).
    if (context === null || context.state !== state) {
      this.cancelPending();
      this.authService.setLoading(false);
      return throwError(() => this.mapError({ status: 'error' }));
    }

    const request: SocialExchangeRequest = {
      provider: context.provider,
      code,
      code_verifier: context.code_verifier,
      redirect_uri: this.strategy.getRedirectUri(),
    };

    return this.http
      .post<LoginResponse>(`${this.apiBaseUrl}/auth/social/exchange`, request)
      .pipe(
        switchMap((response) => {
          const tokens: TokenPair = {
            access_token: response.access_token,
            id_token: response.id_token,
            refresh_token: response.refresh_token,
            expires_in: response.expires_in,
          };

          // El TokenPair debe estar completo (los 4 campos) antes de finalizar.
          // Una respuesta incompleta se trata como error genérico del backend:
          // no se persiste sesión ni tokens/roles parciales.
          if (!this.isCompleteTokenPair(tokens)) {
            this.cancelPending();
            this.authService.setLoading(false);
            return throwError(() => this.mapError({ status: 'error' }));
          }

          this.authService.completeSocialLogin(tokens, response.roles ?? []);

          // El contexto pendiente ya no es necesario tras finalizar la sesión.
          this.cancelPending();

          // Resolver el destino: Return_URL interna validada o el fallback.
          const target = resolveReturnUrl(
            context.return_url,
            DEFAULT_RETURN_URL,
          );

          return from(this.router.navigateByUrl(target)).pipe(
            tap(() => {
              // Eliminar la Return_URL almacenada tras completar la navegación.
              this.authService.clearReturnUrl();
              this.authService.setLoading(false);
            }),
            switchMap(() => [response]),
          );
        }),
        // Timeout de 30 s del flujo del proveedor (intercambio incluido): si el
        // backend no responde a tiempo, `timeout` emite un `TimeoutError` que
        // se normaliza a un `SocialTimeoutMarker` para que `mapError` lo
        // clasifique como fallo de conexión por tiempo de espera agotado
        // (Requisito 5.4). Implementado con el operador RxJS `timeout` para ser
        // testeable con reloj falso (`fakeAsync`/`tick` o `TestScheduler`).
        timeout({ each: PROVIDER_TIMEOUT_MS }),
        catchError((error) => {
          // Cualquier fallo (red, backend, timeout, navegación) libera el flujo
          // y se traduce a un `AuthError` con mensaje en español vía `mapError`.
          // Nunca se persisten tokens/roles parciales: `completeSocialLogin`
          // sólo se invoca con un `TokenPair` completo y, ante fallo posterior,
          // la sesión ya establecida no se toca aquí (sólo se libera isLoading).
          this.cancelPending();
          this.authService.setLoading(false);
          const marker: SocialTimeoutMarker = { kind: 'timeout' };
          return throwError(() =>
            this.mapError(error instanceof TimeoutError ? marker : error),
          );
        }),
      );
  }

  /**
   * Temporizador local de la verificación de vinculación pendiente (Requisito
   * 4.4).
   *
   * Cuando el backend indica que se requiere verificación adicional antes de
   * vincular la identidad social a una cuenta existente (respuesta `202`), se
   * arranca este temporizador de 300 s. Al expirar, la vinculación se cancela:
   * **no** se crea una cuenta nueva y la cuenta existente se conserva sin
   * cambios (esto se garantiza porque el frontend nunca invoca
   * `completeSocialLogin` en este camino); sólo se limpia el contexto pendiente
   * y se emite el `AuthError` de expiración (`linkVerificationExpired`,
   * `statusCode` 408) para que la UI muestre cómo reintentar.
   *
   * SEAM/ASUNCIÓN: el sondeo real de la verificación contra el backend depende
   * del contrato de `/auth/social/exchange`, aún por coordinar (design.md,
   * "Contrato de dependencia del backend"). Aquí se implementa únicamente el
   * mecanismo del temporizador y el mapeo de expiración; cuando el backend
   * exponga el endpoint de sondeo, la confirmación de la verificación debe
   * competir (`race`) contra este temporizador y cancelarlo al confirmarse.
   *
   * Se implementa con el operador RxJS `timer` para ser testeable con reloj
   * falso (`fakeAsync`/`tick` o `TestScheduler`).
   *
   * @returns Un `Observable` que emite el `AuthError` de verificación expirada
   *   transcurridos {@link LINK_VERIFICATION_TIMEOUT_MS} milisegundos.
   */
  startLinkVerificationTimer(): Observable<AuthError> {
    return timer(LINK_VERIFICATION_TIMEOUT_MS).pipe(
      map(() => {
        // Al expirar la verificación: cancelar la vinculación conservando la
        // cuenta existente (no se persiste sesión ni tokens/roles parciales) y
        // limpiar el contexto pendiente del flujo social.
        this.cancelPending();
        this.authService.setLoading(false);
        return {
          statusCode: 408,
          message: SOCIAL_ERROR_MESSAGES.linkVerificationExpired,
          error: 'link_verification_expired',
        } satisfies AuthError;
      }),
    );
  }

  /**
   * Temporizador local de confirmación del nombre de Apple (Requisito 6.4).
   *
   * Cuando Apple comparte el nombre de la persona únicamente en la primera
   * autenticación, se concede al backend hasta 10 s para confirmar su
   * persistencia. La confirmación (`nameConfirmed$`) compite (`race`) contra el
   * temporizador de expiración:
   * - Si la confirmación llega primero, la sesión se completa con normalidad y
   *   sin mensaje (`nameSaved: true`, `message: null`).
   * - Si el temporizador expira primero, la sesión se completa **igualmente**
   *   (sin el nombre) y se devuelve el mensaje informativo indicando que el
   *   nombre no pudo guardarse (`nameSaved: false`).
   *
   * En ambos casos la autenticación se considera exitosa: la expiración del
   * nombre nunca aborta la sesión, sólo informa. El sondeo/confirmación real
   * contra el backend depende del contrato aún por coordinar; este método
   * encapsula el mecanismo del temporizador y su resolución.
   *
   * Se implementa con operadores RxJS (`timer`/`race`) para ser testeable con
   * reloj falso (`fakeAsync`/`tick` o `TestScheduler`).
   *
   * @param nameConfirmed$ Señal de confirmación de persistencia del nombre por
   *   parte del backend.
   * @returns Un `Observable` que emite `{ nameSaved, message }`: `message` es el
   *   texto informativo cuando el nombre no pudo guardarse a tiempo, o `null` si
   *   se confirmó dentro del plazo.
   */
  confirmAppleName(
    nameConfirmed$: Observable<unknown>,
  ): Observable<{ nameSaved: boolean; message: string | null }> {
    const confirmation$ = nameConfirmed$.pipe(
      map(() => ({ nameSaved: true, message: null })),
    );
    const expiry$ = timer(NAME_CONFIRMATION_TIMEOUT_MS).pipe(
      map(() => ({
        nameSaved: false,
        message: SOCIAL_ERROR_MESSAGES.nameNotConfirmed,
      })),
    );
    // La sesión se establece igualmente en ambos desenlaces; sólo cambia si se
    // informa que el nombre no pudo guardarse.
    return race(confirmation$, expiry$).pipe(
      // `of` conserva compatibilidad de tipos si `nameConfirmed$` completara sin
      // emitir; el desenlace por defecto es "nombre no confirmado".
      catchError(() =>
        of({
          nameSaved: false,
          message: SOCIAL_ERROR_MESSAGES.nameNotConfirmed,
        }),
      ),
    );
  }

  /**
   * Limpia el contexto pendiente del flujo social sin tocar la sesión previa
   * (tokens, roles ni signals del `AuthService`).
   */
  cancelPending(): void {
    localStorage.removeItem(SOCIAL_PENDING_KEY);
  }

  /**
   * Clasifica el origen de un fallo del flujo social y lo traduce a un
   * `AuthError` (`{ statusCode, message, error? }`) con mensaje de UI en español,
   * según la tabla "Error Handling" del diseño.
   *
   * Acepta varias formas de entrada:
   * - `SocialAuthorizeResult` (`{ status: 'cancelled' | 'error' }`): resultado
   *   del flujo del proveedor.
   * - `HttpErrorResponse`: fallo del intercambio contra el backend (red, 400,
   *   202, 409, 5xx). Los sub-casos de `400` se desambiguan por el campo
   *   `error`/`code` del cuerpo (ver `BACKEND_ERROR_CODES`).
   * - `SocialTimeoutMarker` (`{ kind: 'timeout' }`): emitido por los operadores
   *   de timeout (tarea 5.7).
   * - Cualquier otro valor: se mapea al error genérico del backend.
   *
   * Caso especial de cancelación: devuelve `null`. La cancelación **no** produce
   * un mensaje de error y **no** debe alterar el estado previo de la sesión
   * (Requisito 5.1). Quien invoca `mapError` es responsable de no propagar
   * mensaje cuando el resultado es `null`.
   *
   * En todos los finales negativos, el ajuste de `isLoading = false` y la no
   * persistencia de tokens/roles parciales se garantizan en los puntos de
   * llamada (validación de state, token incompleto y `catchError`); `mapError`
   * es puro y sólo construye el `AuthError`.
   *
   * @param source El fallo a clasificar.
   * @returns El `AuthError` mapeado, o `null` si el fallo es una cancelación.
   */
  mapError(source: unknown): AuthError | null {
    // Cancelación por la persona: sin mensaje de error, sin alterar el estado
    // previo. El proveedor puede reportarla como `status: 'cancelled'` o, en el
    // callback Web, como `error=access_denied`.
    if (this.isCancellation(source)) {
      return null;
    }

    // Timeout del flujo (proveedor u operador RxJS de la tarea 5.7): fallo de
    // conexión por tiempo de espera agotado.
    if (isTimeoutMarker(source)) {
      return {
        statusCode: 0,
        message: SOCIAL_ERROR_MESSAGES.timeout,
        error: 'timeout',
      };
    }

    // Resultado de error del flujo del proveedor (nativo o callback Web sin
    // código de autorización válido): error del proveedor (400).
    if (this.isProviderErrorResult(source)) {
      return {
        statusCode: 400,
        message: SOCIAL_ERROR_MESSAGES.provider,
        error: 'provider_error',
      };
    }

    // Fallos del intercambio contra el backend, clasificados por status HTTP.
    if (source instanceof HttpErrorResponse) {
      return this.mapHttpError(source);
    }

    // Cualquier otro fallo no reconocido: error genérico del backend.
    return {
      statusCode: 500,
      message: SOCIAL_ERROR_MESSAGES.generic,
      error: 'unknown_error',
    };
  }

  /**
   * Traduce un `HttpErrorResponse` del intercambio `/auth/social/exchange` a un
   * `AuthError` según su `status` y, para el caso `400`, el código del cuerpo.
   */
  private mapHttpError(error: HttpErrorResponse): AuthError {
    // Fallo de red: `status === 0` (sin respuesta del servidor).
    if (error.status === 0) {
      return {
        statusCode: 0,
        message: SOCIAL_ERROR_MESSAGES.network,
        error: 'network_error',
      };
    }

    // Verificación de vinculación pendiente: el backend responde `202`/estado
    // pendiente.
    if (error.status === 202) {
      return {
        statusCode: 202,
        message: SOCIAL_ERROR_MESSAGES.linkVerificationPending,
        error: 'link_verification_pending',
      };
    }

    // Conflicto de método de autenticación en la vinculación: `409`.
    if (error.status === 409) {
      return {
        statusCode: 409,
        message: SOCIAL_ERROR_MESSAGES.methodConflict,
        error: 'method_conflict',
      };
    }

    // Sub-casos de `400`: se desambiguan por el código del cuerpo.
    if (error.status === 400) {
      const code = this.extractBackendErrorCode(error);
      if (code === BACKEND_ERROR_CODES.emailNotShared) {
        return {
          statusCode: 400,
          message: SOCIAL_ERROR_MESSAGES.emailNotShared,
          error: BACKEND_ERROR_CODES.emailNotShared,
        };
      }
      if (code === BACKEND_ERROR_CODES.extraPermissions) {
        return {
          statusCode: 400,
          message: SOCIAL_ERROR_MESSAGES.extraPermissions,
          error: BACKEND_ERROR_CODES.extraPermissions,
        };
      }
      // `400` sin código reconocido: error del proveedor.
      return {
        statusCode: 400,
        message: SOCIAL_ERROR_MESSAGES.provider,
        error: 'provider_error',
      };
    }

    // Error genérico del backend (`5xx` u otro): se prefiere el mensaje del
    // backend si viene en el cuerpo; en su defecto, el mensaje genérico.
    return {
      statusCode: error.status,
      message: this.extractBackendMessage(error) ?? SOCIAL_ERROR_MESSAGES.generic,
      error: 'backend_error',
    };
  }

  /**
   * Determina si el fallo representa una cancelación por parte de la persona:
   * un `SocialAuthorizeResult` con `status: 'cancelled'`, o un callback con
   * `error === 'access_denied'`.
   */
  private isCancellation(source: unknown): boolean {
    if (typeof source !== 'object' || source === null) {
      return false;
    }
    const result = source as SocialAuthorizeResult & { error?: string };
    return result.status === 'cancelled' || result.error === 'access_denied';
  }

  /**
   * Determina si el fallo es un resultado de error del flujo del proveedor
   * (`SocialAuthorizeResult` con `status: 'error'`).
   */
  private isProviderErrorResult(source: unknown): boolean {
    if (typeof source !== 'object' || source === null) {
      return false;
    }
    return (source as SocialAuthorizeResult).status === 'error';
  }

  /**
   * Extrae el código de error del cuerpo de un `HttpErrorResponse`. El backend
   * puede exponerlo como `error` o `code` (ASUNCIÓN documentada en
   * `BACKEND_ERROR_CODES`).
   */
  private extractBackendErrorCode(error: HttpErrorResponse): string | null {
    const body = error.error;
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const record = body as { error?: unknown; code?: unknown };
    if (typeof record.error === 'string') {
      return record.error;
    }
    if (typeof record.code === 'string') {
      return record.code;
    }
    return null;
  }

  /**
   * Extrae un mensaje legible del cuerpo de un `HttpErrorResponse`, si existe.
   */
  private extractBackendMessage(error: HttpErrorResponse): string | null {
    const body = error.error;
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const record = body as { message?: unknown };
    return typeof record.message === 'string' && record.message.length > 0
      ? record.message
      : null;
  }

  /**
   * Recupera y deserializa el contexto pendiente persistido bajo la clave
   * `sora-sport-social-pending`. Devuelve `null` si no existe o está corrupto.
   */
  private readPendingContext(): SocialAuthPendingContext | null {
    const raw = localStorage.getItem(SOCIAL_PENDING_KEY);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as SocialAuthPendingContext;
    } catch {
      return null;
    }
  }

  /**
   * Determina si un `TokenPair` está completo: los cuatro campos presentes y no
   * vacíos (`access_token`, `id_token`, `refresh_token`, `expires_in`).
   */
  private isCompleteTokenPair(tokens: TokenPair): boolean {
    return (
      !!tokens &&
      !!tokens.access_token &&
      !!tokens.id_token &&
      !!tokens.refresh_token &&
      !!tokens.expires_in
    );
  }

  /**
   * Persiste el contexto pendiente en el almacenamiento del cliente bajo la
   * clave `sora-sport-social-pending`.
   */
  private persistPendingContext(context: SocialAuthPendingContext): void {
    localStorage.setItem(SOCIAL_PENDING_KEY, JSON.stringify(context));
  }

  /**
   * Genera un `code_verifier` PKCE aleatorio criptográficamente seguro,
   * codificado en base64url sin relleno.
   */
  private generateCodeVerifier(): string {
    const bytes = new Uint8Array(PKCE_VERIFIER_BYTES);
    crypto.getRandomValues(bytes);
    return this.base64UrlEncode(bytes);
  }

  /**
   * Genera un `state` opaco aleatorio criptográficamente seguro, codificado en
   * base64url sin relleno.
   */
  private generateState(): string {
    const bytes = new Uint8Array(STATE_BYTES);
    crypto.getRandomValues(bytes);
    return this.base64UrlEncode(bytes);
  }

  /**
   * Deriva el `code_challenge` (método S256) a partir del `code_verifier`:
   * SHA-256 del verifier codificado en ASCII, en base64url sin relleno.
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  /**
   * Codifica un arreglo de bytes en base64url (sin relleno, `+`→`-`, `/`→`_`).
   */
  private base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
