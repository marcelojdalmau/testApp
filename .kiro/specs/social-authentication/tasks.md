# Implementation Plan: Social Authentication

## Overview

Se añade inicio de sesión y registro mediante los proveedores federados Google, Facebook y Apple, reutilizando por completo el contrato de sesión existente (`TokenPair`, `TokenStorageService`, signals del `AuthService`, `authInterceptor` y `authGuard`). El flujo adopta OAuth 2.0 Authorization Code con PKCE contra Cognito. Se introduce una abstracción de estrategia por plataforma (`SocialAuthStrategy`), un servicio orquestador (`SocialAuthService`), un validador puro de `Return_URL` anti open-redirect, un nuevo componente `SocialCallbackComponent` en la ruta `/auth/callback`, y botones de proveedor con consentimiento en `LoginComponent`/`RegisterComponent`. Las tareas construyen de forma incremental, primero la lógica pura y testeable, luego la orquestación, y finalmente el cableado de UI y rutas.

Los tests de propiedad usan fast-check (ya instalado), con un mínimo de 100 iteraciones, etiquetados con el formato del proyecto: `Feature: social-authentication, Property N: <descripción>`. Los tests de integración/contrato del backend (endpoint `/auth/social/exchange`, vinculación de cuentas, Private Relay) dependen del backend y se marcan como tales.

## Tasks

- [x] 1. Definir modelos de datos y validador de Return_URL
  - [x] 1.1 Crear los modelos de autenticación social
    - Crear `src/app/core/models/social-auth.model.ts` con los tipos e interfaces: `SocialProvider` (`'google' | 'facebook' | 'apple'`), `SocialPlatform` (`'web' | 'android' | 'ios'`), `SocialExchangeRequest` (`provider`, `code`, `code_verifier`, `redirect_uri`), `SocialAuthPendingContext` (`state`, `code_verifier`, `provider`, `return_url`, `created_at`), `SocialAuthorizeRequest` (`provider`, `code_challenge`, `state`, `redirect_uri`) y `SocialAuthorizeResult` (`status`, `code?`, `state?`, `errorMessage?`)
    - Reutilizar `TokenPair`, `LoginResponse` y `AuthError` desde `src/app/core/models/auth.model.ts` sin modificarlos
    - _Requirements: 3.1, 10.1_

  - [x] 1.2 Implementar el validador puro de Return_URL anti open-redirect
    - Crear `src/app/core/validators/return-url.validator.ts`
    - Implementar `isInternalReturnUrl(url: string | null): boolean` que acepte únicamente rutas internas relativas (comienzan con `/` y no con `//`, sin esquema ni host) y rechace toda URL absoluta, externa, `//host`, `javascript:` o vacía
    - Implementar `resolveReturnUrl(url: string | null, fallback: string): string` que devuelva la ruta interna validada o el `fallback` (`/feed`) en cualquier otro caso
    - Mantener las funciones puras (sin dependencias de Angular) para su testabilidad
    - _Requirements: 8.3, 8.4, 1.6, 1.7_

  - [x] 1.3 Escribir property test del validador de Return_URL
    - Crear `src/app/core/validators/return-url.validator.property.spec.ts`
    - **Property 1: La validación de Return_URL sólo acepta rutas internas**
    - Generar con fast-check URLs candidatas (relativas internas, `//host`, `http(s)://...`, `javascript:`, vacías) y verificar aceptación sólo de rutas internas; verificar que `resolveReturnUrl` devuelve la interna o `/feed`
    - Etiqueta: `Feature: social-authentication, Property 1: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 8.3, 8.4, 1.6, 1.7**

- [x] 2. Implementar la abstracción de estrategia por plataforma
  - [x] 2.1 Definir la interfaz `SocialAuthStrategy` y el token de inyección
    - Crear `src/app/core/services/social/social-auth-strategy.ts`
    - Definir la interfaz `SocialAuthStrategy` con `authorize(request: SocialAuthorizeRequest): Promise<SocialAuthorizeResult>` y `getRedirectUri(): string`
    - Definir `export const SOCIAL_AUTH_STRATEGY = new InjectionToken<SocialAuthStrategy>('SOCIAL_AUTH_STRATEGY')`
    - Definir la constante de scopes solicitados exactamente como `{ email, name }` para reutilizarla en las estrategias
    - _Requirements: 7.1, 9.1, 9.2_

  - [x] 2.2 Implementar `WebSocialAuthStrategy`
    - Crear `src/app/core/services/social/web-social-auth.strategy.ts`
    - Construir la URL `authorize` de Cognito con `response_type=code`, `code_challenge`, `state`, `redirect_uri` y scopes limitados a `{ email, name }`
    - `getRedirectUri()` devuelve `origin + /auth/callback`
    - `authorize()` ejecuta `window.location.assign(url)` (el resultado llega por el callback, no por retorno)
    - _Requirements: 7.1, 9.1, 9.2, 8.6_

  - [x] 2.3 Implementar `NativeSocialAuthStrategy`
    - Crear `src/app/core/services/social/native-social-auth.strategy.ts`
    - `getRedirectUri()` devuelve el esquema/deep link (`com.sorasport://auth`)
    - `authorize()` abre el in-app browser (iOS `ASWebAuthenticationSession` / Android Chrome Custom Tabs) detrás de esta estrategia y resuelve con `{ code, state }` o `status: 'cancelled'` cuando la persona cierra el navegador
    - Aislar la integración nativa concreta detrás de esta clase para que el resto del código no dependa de ella
    - _Requirements: 7.2, 7.3, 9.1, 9.2_

  - [x] 2.4 Crear el resolvedor de estrategia por plataforma y registrarlo en `app.config.ts`
    - Crear `src/app/core/services/social/social-auth-strategy.provider.ts` con una factory que detecte la plataforma (`web`/`android`/`ios`) y devuelva la estrategia correspondiente, garantizando una estrategia no nula para las tres plataformas
    - Registrar el provider de `SOCIAL_AUTH_STRATEGY` en `src/app/app.config.ts`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.5 Escribir property test de resolución de estrategia por plataforma
    - Crear `src/app/core/services/social/social-auth-strategy.property.spec.ts`
    - **Property 5: Resolución de estrategia por plataforma**
    - Generar con fast-check una plataforma en `{ web, android, ios }` y verificar que el resolvedor devuelve una estrategia no nula que ofrece los tres proveedores (`google`, `facebook`, `apple`)
    - Etiqueta: `Feature: social-authentication, Property 5: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 3. Extender `AuthService` y ajustar el `authInterceptor`
  - [x] 3.1 Añadir `completeSocialLogin` a `AuthService`
    - Añadir en `src/app/core/services/auth.service.ts` el método `completeSocialLogin(tokens: TokenPair, roles: string[]): void`, sin alterar los métodos existentes
    - Validar internamente que `tokens` tenga los 4 campos no vacíos (`access_token`, `id_token`, `refresh_token`, `expires_in`); si falta alguno, descartar los datos parciales y dejar `isAuthenticated` en falso
    - En éxito: `tokenStorage.storeTokens(tokens)`, `tokenStorage.storeRoles(roles)`, `_isAuthenticated.set(true)`, `_userRoles.set(roles)`
    - _Requirements: 1.4, 1.5, 1.12, 3.2, 3.7, 7.5_

  - [x] 3.2 Escribir unit tests de `completeSocialLogin`
    - Añadir casos en `src/app/core/services/auth.service.spec.ts`
    - Verificar persistencia de tokens/roles y signals en éxito; verificar descarte de `TokenPair` incompleto y `isAuthenticated` en falso
    - _Requirements: 1.4, 1.5, 1.12_

  - [x] 3.3 Escribir property test de finalización de sesión consistente
    - Añadir en `src/app/core/services/auth.service.property.spec.ts`
    - **Property 3: La finalización exitosa establece un estado de sesión consistente**
    - Generar con fast-check `TokenPair` válido + roles; tras `completeSocialLogin` + navegación, verificar que el storage (`sora-sport-auth-tokens` y roles) contiene exactamente esos valores, `isAuthenticated` es verdadero, `userRoles` igual a los roles, `isLoading` falso y la `Return_URL` almacenada eliminada
    - Etiqueta: `Feature: social-authentication, Property 3: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 1.4, 1.5, 3.2, 3.7, 7.5, 8.5**

  - [x] 3.4 Ajustar el `authInterceptor` para saltar `/auth/social/exchange`
    - Añadir `/auth/social/exchange` a la lista `AUTH_ENDPOINTS` en `src/app/core/interceptors/auth.interceptor.ts` para que la petición de intercambio no adjunte Bearer ni dispare la lógica de 401/refresh
    - _Requirements: 3.3, 3.5, 3.6_

  - [x] 3.5 Escribir unit test del interceptor para `/auth/social/exchange`
    - Añadir caso en `src/app/core/interceptors/auth.interceptor.spec.ts` verificando que la petición a `/auth/social/exchange` no adjunta Bearer y no dispara refresh
    - _Requirements: 3.3, 3.6_

- [x] 4. Checkpoint - Verificación de lógica pura y servicios base
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar `SocialAuthService`
  - [x] 5.1 Implementar generación PKCE + state y persistencia del contexto pendiente
    - Crear `src/app/core/services/social/social-auth.service.ts` (`providedIn: 'root'`), inyectando `SOCIAL_AUTH_STRATEGY`, `HttpClient`, `AuthService`, `TokenStorageService`, `Router` y `API_BASE_URL`
    - Implementar la generación de `code_verifier`/`code_challenge` (PKCE) y un `state` aleatorio opaco
    - Implementar `startSocialLogin(provider: SocialProvider): Promise<void>`: genera PKCE + state, persiste `SocialAuthPendingContext` (clave `sora-sport-social-pending`) incluyendo la `Return_URL` validada como ruta interna, resuelve `redirect_uri` vía la estrategia y delega en `strategy.authorize(...)`
    - Implementar `cancelPending(): void` que limpia el contexto pendiente sin tocar la sesión previa
    - _Requirements: 1.2, 8.6, 10.1, 10.5_

  - [x] 5.2 Escribir property test de round-trip del contexto pendiente
    - Crear `src/app/core/services/social/social-auth.service.property.spec.ts`
    - **Property 2: Round-trip del contexto (state / Return_URL) a través del redirect**
    - Generar con fast-check pares `{ state, returnUrl }`, persistir y recuperar por `state`; verificar igualdad exacta de la `Return_URL` y que otro `state` no recupera el contexto
    - Etiqueta: `Feature: social-authentication, Property 2: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 8.6, 8.3**

  - [x] 5.3 Escribir property test de construcción de `SocialExchangeRequest` sin tenant
    - Añadir en `social-auth.service.property.spec.ts`
    - **Property 7: La solicitud de intercambio nunca incluye tenant**
    - Generar con fast-check contextos de entrada (con y sin identificador de tenant/institución inyectado) y verificar que el `SocialExchangeRequest` construido contiene únicamente `provider`, `code`, `code_verifier` y `redirect_uri`
    - Etiqueta: `Feature: social-authentication, Property 7: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 10.1, 10.5**

  - [x] 5.4 Escribir property test de scopes exactos {email, name}
    - Añadir en `social-auth.service.property.spec.ts` (o en el spec de la estrategia web)
    - **Property 6: Los scopes solicitados se limitan a correo y nombre**
    - Generar con fast-check un proveedor soportado y verificar que el conjunto de scopes/campos de perfil de la URL de autorización es exactamente `{ email, name }`, sin campos adicionales
    - Etiqueta: `Feature: social-authentication, Property 6: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 9.1, 9.2**

  - [x] 5.5 Implementar `handleCallback` con intercambio y finalización de sesión
    - Implementar `handleCallback(code: string, state: string): Observable<LoginResponse>`: valida el `state` contra el contexto pendiente, recupera `code_verifier` y `return_url`, ejecuta `POST /auth/social/exchange` con `SocialExchangeRequest`, valida que el `TokenPair` tenga los 4 campos y delega en `AuthService.completeSocialLogin(tokens, roles)`
    - Coordinar el signal `isLoading` (verdadero al iniciar el flujo, falso en éxito o error)
    - Al finalizar con éxito, resolver la `Return_URL` con el validador (`resolveReturnUrl`) y navegar a ella o a `/feed`, y eliminar la `Return_URL` almacenada tras completar la navegación
    - _Requirements: 1.3, 1.4, 1.8, 1.9, 2.2, 2.3, 2.4, 2.5, 8.3, 8.4, 8.5, 10.2, 10.3_

  - [x] 5.6 Implementar el mapeo de errores a `AuthError` con mensajes en español
    - Implementar `mapError(...)` en `SocialAuthService` según la tabla del diseño: cancelación (sin mensaje de error, sin alterar estado), error del proveedor (400), fallo de red (`status === 0`), correo no compartido (400), verificación de vinculación pendiente (202), conflicto de método (409), permisos extra fuera de `{email, name}` (400) y error genérico del backend (5xx)
    - Garantizar que en todo final negativo `isLoading` queda en falso y no se persisten tokens/roles parciales
    - _Requirements: 1.11, 2.6, 2.7, 4.3, 4.5, 5.1, 5.2, 5.3, 5.5, 5.6, 6.2, 9.5_

  - [x] 5.7 Implementar los timeouts del flujo (30 s, 300 s, 10 s)
    - Aplicar `timeout(30000)` al flujo del proveedor: al expirar, cancelar el intento y mapear a mensaje de conexión (Req 5.4)
    - Implementar el temporizador local de 300 s para la verificación de vinculación pendiente: al expirar, cancelar la vinculación, conservar la cuenta existente y mostrar mensaje de expiración (Req 4.4)
    - Implementar el temporizador local de 10 s para la confirmación del nombre de Apple: al expirar, completar la sesión sin el nombre e indicar mediante mensaje que no pudo guardarse (Req 6.4)
    - Implementar los timeouts con operadores de RxJS o temporizadores explícitos, testeables con reloj falso
    - _Requirements: 5.4, 4.4, 6.4, 6.5_

  - [x] 5.8 Escribir property test de atomicidad ante fallo o TokenPair inválido
    - Añadir en `social-auth.service.property.spec.ts`
    - **Property 4: Atomicidad del estado ante fallo o TokenPair inválido**
    - Generar con fast-check resultados negativos (cancelación, error de proveedor, red, timeout, backend) y `TokenPair` incompletos; verificar ausencia de tokens/roles parciales, `isAuthenticated` falso e `isLoading` falso
    - Etiqueta: `Feature: social-authentication, Property 4: ...`; mínimo 100 iteraciones
    - **Validates: Requirements 1.11, 1.12, 2.6, 5.6, 5.7, 7.6**

  - [x] 5.9 Escribir unit tests de `SocialAuthService` con reloj falso
    - Añadir en `src/app/core/services/social/social-auth.service.spec.ts` usando estrategia mock y `HttpTestingController`
    - Cubrir mapeo de errores (proveedor / red / backend / correo no compartido 400 / conflicto 409 / verificación pendiente 202 / permisos extra), y edge cases con reloj falso: timeout de 30 s, expiración de verificación a 300 s, nombre no confirmado a 10 s, y cancelación (`cancelled` sin `errorMessage` ni cambio de estado)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 4.3, 4.4, 4.5, 6.2, 6.4, 9.5_

- [x] 6. Checkpoint - Verificación del servicio de orquestación social
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar el componente de callback y su ruta
  - [x] 7.1 Crear `SocialCallbackComponent`
    - Crear `src/app/features/auth/callback/social-callback.component.ts` como componente standalone con `ChangeDetectionStrategy.OnPush`
    - Leer `code` y `state` de los query params; si hay `error`/`error_description` o falta `code`, tratar como error/cancelación
    - Invocar `socialAuthService.handleCallback(code, state)`; mostrar un spinner mientras procesa
    - En error, redirigir a `/auth/login` con el mensaje correspondiente (la navegación de éxito la resuelve `handleCallback`)
    - _Requirements: 1.7, 5.1, 5.2, 8.3_

  - [x] 7.2 Registrar la ruta `/auth/callback`
    - Añadir en `src/app/features/auth/auth.routes.ts` la ruta `callback` con `loadComponent` hacia `SocialCallbackComponent`
    - _Requirements: 1.7, 8.3_

  - [x] 7.3 Escribir unit tests de `SocialCallbackComponent`
    - Crear `src/app/features/auth/callback/social-callback.component.spec.ts`
    - Verificar procesamiento con `code`+`state` válidos, y tratamiento de `error`/`access_denied` como error/cancelación con redirección a login
    - _Requirements: 5.1, 5.2_

- [x] 8. Integrar botones de proveedor en Login y Register
  - [x] 8.1 Añadir botones de proveedor y consentimiento a `LoginComponent`
    - Extender `src/app/features/auth/login/` con la sección "O continuá con" y tres botones (Google, Facebook, Apple) identificables por nombre y logotipo
    - Cablear cada botón a `socialAuthService.startSocialLogin(provider)`
    - Deshabilitar los tres botones y mostrar indicador de carga mientras `isLoading` es verdadero; rehabilitarlos al finalizar (éxito o error) y mostrar `errorMessage` en español
    - Añadir el control visible de consentimiento ("¿Qué datos solicitamos?") que despliega correo electrónico y nombre y su finalidad
    - En iOS, cuando se muestran Google/Facebook, presentar siempre Apple en la misma interfaz (Guideline 4.8)
    - No mostrar ningún selector de institución/tenant en la sección social
    - _Requirements: 1.1, 1.2, 1.8, 1.10, 1.13, 5.7, 7.4, 9.3, 9.4, 10.4_

  - [x] 8.2 Añadir botones de proveedor y consentimiento a `RegisterComponent`
    - Extender `src/app/features/auth/register/` con los tres botones de proveedor (nombre + logotipo), reutilizando el mismo flujo `startSocialLogin(provider)` que el login
    - Aplicar estados de carga/deshabilitado y rehabilitación en error, el control de consentimiento (correo y nombre), el cumplimiento de la Guideline 4.8 en iOS y la ausencia de selector de tenant
    - Mostrar el mensaje de correo no compartido cuando corresponda (Req 2.7)
    - _Requirements: 2.1, 2.4, 2.6, 2.7, 7.4, 9.3, 9.4, 10.4_

  - [x] 8.3 Escribir unit tests de la UI social de Login y Register
    - Añadir casos en `src/app/features/auth/login/login.component.spec.ts` y `src/app/features/auth/register/register.component.spec.ts`
    - Verificar renderizado de los 3 botones en ambos componentes; presencia de Apple junto a Google/Facebook en iOS; contenido del control de consentimiento; ausencia de selector de tenant; que el click invoca `startSocialLogin(provider)` con estrategia mock; que `isLoading` deshabilita botones; y que un error rehabilita y muestra mensaje
    - _Requirements: 1.1, 1.2, 1.10, 1.13, 2.1, 7.4, 9.3, 9.4, 10.4_

- [x] 9. Checkpoint final - Verificación completa (build + tests)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las sub-tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido; las tareas de implementación núcleo nunca se marcan como opcionales.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Los checkpoints aseguran validación incremental (build de Angular + tests con Jasmine/Karma en ChromeHeadless, usando `--watch=false` para ejecución única).
- Los property tests (fast-check, mínimo 100 iteraciones) validan las 7 propiedades universales del diseño y se etiquetan con `Feature: social-authentication, Property N: ...`.
- Los unit tests validan ejemplos, edge cases (con reloj falso para los timeouts de 30 s / 300 s / 10 s) y mapeo de errores.
- Los tests de integración/contrato del backend (`POST /auth/social/exchange`, vinculación de cuentas por correo, Private Relay de Apple, persistencia del nombre) dependen del backend, que aún no expone el endpoint; se coordinan con el equipo de backend y quedan fuera de las tareas de codificación de este frontend hasta que el contrato esté disponible.
- El flujo social termina al establecer la sesión; la selección de tenant/institución queda fuera de alcance (Requisito 10).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1", "3.4"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.5"] },
    { "id": 3, "tasks": ["2.4", "5.1"] },
    { "id": 4, "tasks": ["2.5", "5.2", "5.5"] },
    { "id": 5, "tasks": ["5.3", "5.6", "5.7", "7.1"] },
    { "id": 6, "tasks": ["5.4", "5.9", "7.2", "8.1", "8.2"] },
    { "id": 7, "tasks": ["5.8", "7.3", "8.3"] }
  ]
}
```
