# Implementation Plan: register-reform

## Overview

Plan de implementación incremental para la reforma del registro (correo + contraseña) y el enrutamiento posterior al inicio de sesión según la completitud del perfil. El trabajo se realiza en TypeScript/Angular sobre el proyecto `Sport_fe`. Cada paso se apoya en los anteriores: primero configuración y modelos, luego el helper compartido de errores, después los servicios (`AuthService.register`, `ProfileService`, `ProfileCompletenessService`), el orquestador `PostLoginNavigator`, la UI de registro, el cableado en `LoginComponent`/`SetPasswordComponent`, la ruta `/profile/complete`, y por último la verificación de build/tests. Las sub-tareas de pruebas están marcadas con `*` (opcionales).

## Tasks

- [x] 1. Definir configuración inyectable
  - [x] 1.1 Crear el token `DEFAULT_TENANT_ID`
    - Añadir `InjectionToken<string | null>` en `src/app/core/config/api.config.ts` (mismo patrón que `API_BASE_URL`), con `providedIn: 'root'` y `factory: () => null`.
    - Documentar que el `tenant_id` solo se envía cuando el token resuelve a un valor no vacío.
    - _Requirements: 2.6_

  - [x] 1.2 Crear el token `PROFILE_REQUIRED_FIELDS`
    - Añadir `InjectionToken<RequiredFieldPath[]>` (con `type RequiredFieldPath = string`) en un archivo de configuración de perfil (p. ej. `src/app/core/config/profile.config.ts`).
    - Valor por defecto: los campos requeridos del bloque `common` (`common.profilePhoto`, `common.email`, `common.firstName`, `common.lastName`, `common.birthDate`, `common.identityDocumentNumber`, `common.documentTypeId`, `common.idCardVerification`, `common.nationalityId`, `common.sexId`, `common.personTypeId`).
    - _Requirements: 5.2, 5.3_

- [x] 2. Actualizar modelos de datos
  - [x] 2.1 Reducir `RegisterRequest` y añadir `ProfileResponse`
    - En `src/app/core/models/auth.model.ts`, dejar `RegisterRequest` con exactamente `email` y `password`; eliminar `full_name`, `tenant_id` y `account_type`.
    - Añadir la interfaz `ProfileResponse { profile: UserProfileDto; profile_complete?: boolean }` (importando `UserProfileDto` desde `src/app/core/models/user-profile-dto.model.ts`), en `auth.model.ts` o en un modelo de perfil dedicado.
    - _Requirements: 2.4, 4.2, 5.1_

- [x] 3. Extraer el helper compartido de mapeo de errores HTTP
  - [x] 3.1 Crear `mapHttpErrorToAuthError`
    - Extraer de `AuthService.handleError` una función/helper reutilizable que mapee: estado 0 → `AuthError` de conectividad; extracción segura del `Error_Body.error`; otros estados → `AuthError` con mensaje del cuerpo o genérico.
    - Refactorizar `AuthService.handleError` para delegar en el helper, preservando el comportamiento actual.
    - _Requirements: 3.6, 4.3, 4.4_

  - [x] 3.2 Escribir pruebas unitarias del helper
    - Cubrir estado 0 (conectividad), `Error_Body` legible, `Error_Body` vacío/ilegible (fallback genérico) y otros estados.
    - _Requirements: 3.6, 4.3, 4.4_

- [x] 4. Reformar `AuthService.register()`
  - [x] 4.1 Actualizar el cuerpo de la petición y el timeout
    - Inyectar `DEFAULT_TENANT_ID`; construir el cuerpo con exactamente `email` y `password`, más `tenant_id` solo cuando el token provee un valor no vacío.
    - Eliminar el envío de `full_name` y `account_type`.
    - Aplicar `timeout(10000)` antes de `catchError`, mapeando el vencimiento al `AuthError` de estado 0 vía el helper compartido.
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.6_

  - [x] 4.2 Escribir prueba de propiedad para el cuerpo de registro
    - **Property 1: El cuerpo de registro contiene exactamente el conjunto permitido**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**
    - fast-check, ≥100 iteraciones; generar (email, password) arbitrarios y `DEFAULT_TENANT_ID` con/sin valor; verificar el conjunto exacto de claves con `HttpTestingController`.

- [x] 5. Reformar `RegisterComponent`
  - [x] 5.1 Reducir el formulario y sus validadores
    - En `src/app/features/auth/register/register.component.ts`, dejar los controles `email`, `password`, `confirmPassword`; eliminar `full_name`, `tenant_id`, `account_type` y sus validadores (`nonBlank`, `maxLength(200)`, `uuid`).
    - Actualizar la plantilla HTML para eliminar los campos removidos y mapear los mensajes en español (Req 1.3–1.7).
    - Mantener el control de envío deshabilitado mientras el formulario es inválido y habilitado en ≤1s cuando es válido; enviar solo `email` y `password`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.5_

  - [x] 5.2 Ajustar el manejo de respuesta y errores del registro
    - Mostrar mensaje de confirmación en ≤2s ante 201; mapear 409 (email ya registrado), 400 (validación con fallback genérico), 500 (servidor), 0 (conectividad).
    - Preservar los valores del formulario en las ramas de error, limpiando únicamente contraseña y confirmación; eliminar el caso 404 "institución".
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.3 Escribir pruebas unitarias de `RegisterComponent`
    - Validación de correo (vacío/blancos, >254, formato), contraseña (8–72), coincidencia de confirmación; deshabilitado del envío mientras es inválido; preservación de valores y limpieza de contraseña en 409/400/500/0; mensaje de éxito 201.
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Checkpoint - Registro reformado
  - Asegúrate de que todas las pruebas pasen; pregunta al usuario si surgen dudas.

- [x] 7. Implementar `ProfileService`
  - [x] 7.1 Crear `ProfileService.fetchProfile()`
    - Servicio `@Injectable({ providedIn: 'root' })` en `src/app/core/services/profile.service.ts`; `GET {API_BASE_URL}/users/me` devolviendo `ProfileResponse`.
    - Aplicar `timeout(10000)` y `catchError` usando el helper `mapHttpErrorToAuthError`; no manipular tokens (los adjunta el interceptor).
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Escribir pruebas de `ProfileService`
    - 200 con perfil, timeout de 10s → `AuthError` de conectividad, error de backend → `AuthError`, con `HttpTestingController`.
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 8. Implementar `ProfileCompletenessService` (Completeness_Resolver)
  - [x] 8.1 Crear `resolve()` con precedencia de bandera y respaldo por campos
    - Servicio `@Injectable({ providedIn: 'root' })` en `src/app/core/services/profile-completeness.service.ts`; inyectar `PROFILE_REQUIRED_FIELDS`.
    - Preferir bandera booleana (`true`→complete, `false`→incomplete); en ausencia/nulo/no booleano, evaluar presencia de todos los `PROFILE_REQUIRED_FIELDS` (presente = no nulo y distinto de cadena vacía; objeto no vacío).
    - Ejecución síncrona (≤200ms); ante excepción → `{ status: 'incomplete', errored: true }` sin mutar el perfil.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 8.2 Escribir prueba de propiedad para la precedencia de la bandera
    - **Property 2: La precedencia de la bandera de completitud es determinista**
    - **Validates: Requirements 5.1**
    - fast-check, ≥100 iteraciones; perfiles arbitrarios y banderas booleanas.

  - [x] 8.3 Escribir prueba de propiedad para el respaldo por campos requeridos
    - **Property 3: El respaldo por campos requeridos es correcto**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - fast-check, ≥100 iteraciones; banderas no booleanas y perfiles con `common` parcial/completo.

  - [x] 8.4 Escribir prueba de propiedad para campos opcionales
    - **Property 4: Los campos opcionales no afectan la completitud**
    - **Validates: Requirements 5.5**
    - fast-check, ≥100 iteraciones; requeridos presentes + opcionales aleatorios.

  - [x] 8.5 Escribir prueba de propiedad para degradación segura ante fallo
    - **Property 6: El fallo de resolución degrada de forma segura**
    - **Validates: Requirements 5.7, 6.5**
    - fast-check, ≥100 iteraciones; forzar excepción interna y verificar `incomplete` + perfil no mutado.

- [x] 9. Checkpoint - Perfil y resolución de completitud
  - Asegúrate de que todas las pruebas pasen; pregunta al usuario si surgen dudas.

- [x] 10. Implementar `PostLoginNavigator`
  - [x] 10.1 Crear la orquestación fetch → resolver → navegar
    - Servicio `@Injectable({ providedIn: 'root' })` en `src/app/core/services/post-login-navigator.service.ts`; inyectar `ProfileService`, `ProfileCompletenessService`, `AuthService`, `Router`.
    - `navigateAfterLogin()`: `fetchProfile()` → `timeout(5000)` global → `resolve()` → `route()`; devolver `Observable<void>`.
    - `route()`: incompleto → `clearReturnUrl()` + navegar a `/profile/complete`; completo → `returnUrl` si existe, si no `/feed`.
    - Distinguir fallo de fetch (propagar `AuthError`, permanecer en login) de fallo/timeout de resolución (navegar a `/profile/complete` con aviso).
    - _Requirements: 4.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 10.2 Escribir prueba de propiedad para el destino posterior al login
    - **Property 5: El destino posterior al login es función de la completitud y la URL de retorno**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - fast-check, ≥100 iteraciones; resultado de completitud y presencia/ausencia de URL de retorno, con `Router` espía.

  - [x] 10.3 Escribir pruebas unitarias de `PostLoginNavigator`
    - Complete→returnUrl/`/feed`; incomplete→`/profile/complete`; fallo de fetch→permanecer en login sin navegar; fallo/timeout de resolución→`/profile/complete`+aviso.
    - _Requirements: 4.3, 4.4, 6.5_

- [x] 11. Añadir la ruta `/profile/complete`
  - [x] 11.1 Registrar la ruta de completar perfil
    - En `src/app/features/profile/profile.routes.ts`, añadir `{ path: 'complete', loadComponent: ... }` apuntando a un componente placeholder (el contenido del formulario queda fuera de alcance).
    - Verificar que queda bajo el shell protegido por `authGuard` (definido en `app.routes.ts`).
    - _Requirements: 6.2_

  - [x] 11.2 Escribir prueba de integración de enrutamiento
    - Verificar que `/profile/complete` es alcanzable con sesión válida bajo `authGuard`.
    - _Requirements: 6.2_

- [x] 12. Cablear el enrutamiento posterior al login
  - [x] 12.1 Integrar `PostLoginNavigator` en `LoginComponent`
    - En `src/app/features/auth/login/login.component.ts`, tras un login sin reto, invocar `navigateAfterLogin()`; en error de fetch mostrar mensaje y permanecer en login; sustituir la navegación directa a returnUrl/`/feed`.
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 12.2 Integrar `PostLoginNavigator` en `SetPasswordComponent`
    - En `src/app/features/auth/set-password/set-password.component.ts`, tras `respondToChallenge`, invocar el mismo `navigateAfterLogin()` (paridad de comportamiento con login sin reto).
    - Mantener la sesión activa ante fallo de resolución; impedir el acceso a rutas protegidas hasta resolver el enrutamiento posterior.
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 12.3 Escribir pruebas de paridad del flujo de reto
    - Verificar que `SetPasswordComponent` aplica idéntica resolución/enrutamiento y que la sesión permanece activa ante fallo de resolución.
    - _Requirements: 7.1, 7.3, 7.4_

- [x] 13. Verificación final - build y pruebas
  - [x] 13.1 Ejecutar build y suite de pruebas
    - Ejecutar la compilación del proyecto y `ng test`/`vitest --run` para toda la suite; corregir errores de tipos, imports rotos o pruebas fallidas derivados de la reforma.
    - Confirmar que no queda código huérfano de los campos eliminados (`full_name`, `tenant_id`, `account_type`).
    - _Requirements: 1.1, 2.1, 4.1, 5.1, 6.1, 7.1_

- [x] 14. Checkpoint final - Todo integrado
  - Asegúrate de que todas las pruebas pasen; pregunta al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Los checkpoints garantizan validación incremental.
- Las pruebas de propiedad usan **fast-check** con **≥100 iteraciones** y etiquetan cada propiedad con el formato **Feature: register-reform, Property {número}: {texto}**; validan las propiedades de corrección del diseño.
- Las pruebas unitarias/por ejemplos validan casos concretos, UI, integración HTTP y errores.
- Puntos marcados **[CONFIRMAR CON BACKEND]** en el diseño (ruta del Profile_Endpoint `/users/me` y ubicación de `profile_complete`): si cambian, solo se ajustan `ProfileService` y `PROFILE_REQUIRED_FIELDS`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1"] },
    { "id": 1, "tasks": ["2.1", "3.2"] },
    { "id": 2, "tasks": ["4.1", "7.1", "8.1", "11.1"] },
    { "id": 3, "tasks": ["4.2", "5.1", "7.2", "8.2", "8.3", "8.4", "8.5", "11.2"] },
    { "id": 4, "tasks": ["5.2", "10.1"] },
    { "id": 5, "tasks": ["5.3", "10.2", "10.3", "12.1", "12.2"] },
    { "id": 6, "tasks": ["12.3", "13.1"] }
  ]
}
```
