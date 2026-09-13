# Implementation Plan: Auth Backend Integration

## Overview

This plan aligns the existing Angular authentication layer to the finished backend contracts and finishes wiring the password-recovery and `NEW_PASSWORD_REQUIRED` challenge flows. The work is incremental: it starts from the foundational, dependency-free pieces (models, validators, storage, config) so downstream code can compile against them, then updates `AuthService`, then the page components, then wires everything through `API_BASE_URL`, and finally adds property-based and unit tests. Each task builds on the previous ones so there is no orphaned code.

All code is TypeScript/Angular (standalone components, signals, reactive forms). Tests run under the existing Jasmine + Karma toolchain (`ng test`) and use `fast-check` (already a dev dependency) for property-based tests, `HttpClientTestingModule` / `HttpTestingController` for HTTP assertions, and `localStorage` for storage round-trips.

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [x] 1. Align auth data models to backend contracts
  - [x] 1.1 Update `auth.model.ts` interfaces
    - In `src/app/core/models/auth.model.ts`, add required `default_tenant_id: string` to `LoginResponse` and keep the optional `challenge?: 'NEW_PASSWORD_REQUIRED'` and `session?: string` fields
    - Add required `full_name: string` and required `tenant_id: string` to `RegisterRequest`, keep optional `account_type?: string`
    - Add `full_name: string` to `RegisterResponse`
    - Ensure `ConfirmForgotPasswordRequest` (`email`, `code`, `new_password`), `ChallengeResponse` (`session`, `email`, `new_password`), `RefreshResponse`, and `AuthError` (`statusCode`, `message`, `error?`) match the design
    - _Requirements: 2.1, 3.1, 5.1, 6.1_

- [x] 2. Extend validators and storage foundations
  - [x] 2.1 Add `uuid()` and `maxLength()` validators
    - In `src/app/core/validators/auth.validators.ts`, add `AuthValidators.uuid()` that rejects any value not matching the canonical 8-4-4-4-12 RFC 4122 UUID layout, returning `{ uuid: { message } }` on failure
    - Add `AuthValidators.maxLength(max)` that rejects values whose trimmed length exceeds `max`, used for `full_name` ≤ 200
    - Note: empty `full_name` is handled by `required()` (Req 5.5); `maxLength(200)` covers the >200 case (Req 5.6)
    - _Requirements: 5.4, 5.6_

  - [ ]* 2.2 Write property test for `uuid()` validator
    - **Property 9: UUID validation acceptance and rejection** — canonical UUIDs pass, non-UUID strings fail
    - Use `fc.uuid()` for the acceptance side; arbitrary strings filtered to the non-UUID set for rejection
    - **Validates: Requirements 5.4**

  - [ ]* 2.3 Write property test for `maxLength()` full-name validation
    - **Property 10: Full-name length validation boundary** — errors when trimmed value is empty or > 200, passes for trimmed length 1–200 inclusive
    - **Validates: Requirements 5.5, 5.6**

  - [ ]* 2.4 Write property tests for existing email/password/required/match validators
    - **Property 2: Email length validation boundary** (> 254 errors, ≤ 254 does not flag length) — **Validates: Requirements 1.3, 5.7, 11.2**
    - **Property 3: Password length validation boundary** (< 8 or > 72 errors, 8–72 passes) — **Validates: Requirements 1.5, 5.8, 12.4, 13.2**
    - **Property 11: Non-blank required validation** (whitespace/empty errors, non-whitespace passes) — **Validates: Requirements 12.2**
    - **Property 12: Password confirmation match** (no error iff equal) — **Validates: Requirements 12.5, 13.3**

  - [x] 2.5 Add `default_tenant_id` persistence to `TokenStorageService`
    - In `src/app/core/services/token-storage.service.ts`, add a `TENANT_KEY` slot and `storeDefaultTenantId(tenantId)`, `getDefaultTenantId()`, and `clearDefaultTenantId()` methods
    - Include the tenant id removal in `clearAll()` so logout and refresh-failure leave no stale tenant
    - _Requirements: 2.4_

  - [ ]* 2.6 Write unit tests for `TokenStorageService` tenant-id slot
    - Test store/get/clear round-trip for `default_tenant_id` and that `clearAll()` removes it alongside tokens and roles
    - _Requirements: 2.4_

- [x] 3. Confirm API base URL configuration
  - [x] 3.1 Verify and align `API_BASE_URL` token
    - In `src/app/core/config/api.config.ts`, ensure `API_BASE_URL` is an `InjectionToken<string>` with `factory: () => 'http://localhost:8000'`, overridable via provider without editing `AuthService`
    - _Requirements: 10.2, 10.3_

  - [ ]* 3.2 Write unit tests for default and overridden base URL
    - Test that the default resolves to the local backend address and that a DI override replaces it without touching `AuthService`
    - _Requirements: 10.2, 10.3_

- [x] 4. Update AuthService to match verified contracts
  - [x] 4.1 Rewrite `handleError` to extract from the `{ error }` body shape
    - In `src/app/core/services/auth.service.ts`, replace the current `error.error?.message || error.error?.detail` extraction with extraction from `{ "error": "<message>" }`: on status 0 return `{ statusCode: 0, message: 'Unable to connect. Check your internet connection.' }`; otherwise read a string `error` field into both `message` and `error`, falling back to a generic message when absent
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 4.6, 11.7, 13.10_

  - [x] 4.2 Align `login`, `refreshToken`, and `logout` bodies and behavior
    - `login` sends body exactly `{ email, password }`; on a 200 without `challenge`, persist tokens, roles, and `default_tenant_id` via `TokenStorageService` and set `isAuthenticated` true; on a `challenge` response persist nothing and return the response. Token persistence is partial-success tolerant: each token value is written independently, and a single storage write failure must not abort the other writes nor fail a successful 200 login (Req 2.3)
    - `refreshToken` sends `{ refresh_token }`; on 200 update `access_token`/`id_token`/`expires_in` and retain the existing `refresh_token`; on 401 clear all state and route to login; add a guard that short-circuits to an auth failure and routes to login when no refresh token is stored (no HTTP call)
    - `logout` sends `{ access_token }` and clears all local state on 204 or any error via `finalize`, then routes to login; the same finalize-based clearing also runs when the logout request cannot be sent at all, so local state is cleared and the user is routed to login even if the POST never leaves the client (Req 9.4)
    - _Requirements: 1.1, 1.2, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 4.3 Update `register` and add recovery/challenge methods
    - `register` builds body `{ email, password, full_name, tenant_id, ...(account_type ? { account_type } : {}) }`
    - `forgotPassword(email)` sends body exactly `{ email }`
    - `confirmForgotPassword(data)` sends body exactly `{ email, code, new_password }`
    - `respondToChallenge(data)` sends body exactly `{ session, email, new_password }`; on success persist tokens + roles (and `default_tenant_id` when present) and set `isAuthenticated` true
    - Build every endpoint path from the injected `API_BASE_URL` as `${base}/auth/<path>`
    - _Requirements: 5.2, 5.9, 10.1, 11.1, 12.1, 13.5, 13.6, 13.7_

  - [ ]* 4.4 Write property tests for AuthService request bodies and base URL
    - **Property 1: Login request body carries exactly email and password** — **Validates: Requirements 1.1, 1.2**
    - **Property 14: Refresh request body carries the stored refresh token** — **Validates: Requirements 8.1**
    - **Property 16: Logout request body carries the stored access token** — **Validates: Requirements 9.1**
    - **Property 19: Register request body carries required fields and conditional account_type** — **Validates: Requirements 5.2, 5.9**
    - **Property 20: Forgot-password request body carries exactly email** — **Validates: Requirements 11.1**
    - **Property 21: Confirm-forgot-password request body carries exactly email, code, new_password** — **Validates: Requirements 12.1**
    - **Property 22: Respond-to-challenge request body carries exactly session, email, new_password** — **Validates: Requirements 13.5**
    - **Property 18: Every endpoint path is built from the configured base URL** — **Validates: Requirements 10.1**
    - Capture outgoing requests with `HttpTestingController.expectOne` and assert `Object.keys(req.request.body).sort()` for exact-key properties
    - **Validates: Requirements 1.1, 1.2, 5.2, 5.9, 8.1, 9.1, 10.1, 11.1, 12.1, 13.5**

  - [ ]* 4.5 Write property tests for AuthService persistence and state
    - **Property 4: Login success persists session and authenticates** — **Validates: Requirements 2.2, 2.4, 2.5, 2.6, 3.2**
    - **Property 5: Login challenge neither persists nor authenticates** — **Validates: Requirements 3.3, 3.4**
    - **Property 13: Challenge response success persists session and authenticates** — **Validates: Requirements 13.6, 13.7**
    - **Property 15: Refresh updates rotating tokens and retains the refresh token** — **Validates: Requirements 8.2, 8.3**
    - **Property 17: Logout always clears state and routes to login** — **Validates: Requirements 9.2, 9.3, 9.5**
    - **Validates: Requirements 2.2, 2.4, 2.5, 2.6, 3.2, 3.3, 3.4, 8.2, 8.3, 9.2, 9.3, 9.5, 13.6, 13.7**

  - [ ]* 4.6 Write property tests for AuthService error extraction and connectivity
    - **Property 6: Error message is extracted from the Error_Body `error` field** — generate non-zero statuses and message strings — **Validates: Requirements 7.1, 7.4, 11.6, 12.7, 12.8, 13.9**
    - **Property 7: Missing readable error yields the generic fallback** — bodies lacking a string `error` — **Validates: Requirements 7.2, 7.3**
    - **Property 8: Connectivity failure yields status 0** — status-0 `HttpErrorResponse` across endpoints — **Validates: Requirements 4.6, 11.7, 13.10**
    - **Validates: Requirements 4.6, 7.1, 7.2, 7.3, 7.4, 11.6, 11.7, 12.7, 12.8, 13.9, 13.10**

  - [ ]* 4.7 Write unit tests for refresh and logout special cases
    - Test the missing-refresh-token edge case short-circuits before any HTTP call and routes to `/auth/login` (Req 8.5)
    - Test refresh 401 clears all state and routes to login (Req 8.4)
    - _Requirements: 8.4, 8.5_

  - [ ]* 4.8 Write fault-injection unit tests for AuthService resilience
    - Partial-success token storage on login: a single `TokenStorageService` write throwing must not abort the other writes and must not fail a successful 200 login (Req 2.3)
    - Logout completes locally and routes to `/auth/login` when the request cannot be sent at all (synchronous send failure) (Req 9.4)
    - Malformed/corrupted `Error_Body` (e.g. a non-object body, or an `error` field that is not a readable string) falls back to the generic message (Req 7.2)
    - _Requirements: 2.3, 9.4, 7.2_

- [x] 5. Checkpoint - core service and foundations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update RegisterComponent for tenant_id and full_name
  - [x] 6.1 Add `full_name` and `tenant_id` form controls and payload
    - In `src/app/features/auth/register/register.component.ts`, add a `full_name` control using `required()` (empty blocked, Req 5.5) plus `nonBlank()` + `maxLength(200)` (whitespace-only non-empty / >200 blocked, Req 5.6), and a `tenant_id` control (`required()` + `uuid()`); include both in the submitted payload alongside conditional `account_type`
    - The `email` validator blocks >254 (Req 5.7) and the `password` validator blocks outside 8–72 (Req 5.8)
    - Update the register template to render the new fields and their validation messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 6.2 Add register error mapping including 404 branch
    - Extend `mapError` with a 404 branch (tenant not found) alongside 409 (email already registered), 403 (registration not permitted), and 400 (validation message from `AuthError.message`); show a success message on 201
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.3 Write unit tests for RegisterComponent mapError branches
    - Test 201 success message and 409/404/403/400/other status→message mappings
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 7. Update LoginComponent challenge navigation and error branches
  - [x] 7.1 Confirm challenge navigation and validation
    - In `src/app/features/auth/login/login.component.ts`, ensure a `NEW_PASSWORD_REQUIRED` challenge navigates to `/auth/set-password` with `state: { session, email }`, and non-challenge success navigates to the return URL / `/feed`; verify the email validators block submission when empty (Req 1.4) or >254 (Req 1.3), and the password validator blocks submission outside 8–72 (Req 1.5)
    - _Requirements: 1.3, 1.4, 1.5, 3.2, 3.3, 3.4_

  - [x] 7.2 Confirm login error mapping branches
    - Ensure `mapError` implements the strict-but-satisfiable status→message mapping (Req 4.1) and covers 401 (invalid credentials, Req 4.2), 403 (account not active, Req 4.3), 400 (validation message from `AuthError.message`, Req 4.4), 500/other (generic, Req 4.5), and status 0 connectivity falling through to the generic branch using `AuthError.message` (Req 4.6)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 7.3 Write unit tests for LoginComponent navigation and mapError
    - Router spy assertions for challenge navigation and post-login redirect; status→message assertions for 401/403/400/500/connectivity
    - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 8. Update recovery and challenge page components
  - [x] 8.1 Update ForgotPasswordComponent (enumeration-safe)
    - Send `{ email }` via `AuthService.forgotPassword`, block blank/overlong (>254) email (Req 11.2), block submission on an invalid email independently of whether a validation message is displayed (Req 11.3), navigate to `/auth/reset-password` with `state: { email }` (Req 11.4), and show a generic enumeration-safe confirmation on any outcome (Req 11.5); map errors from the `{ error }` body but keep the visible message generic (Req 11.6), and let connectivity failures surface as status 0 (Req 11.7)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 8.2 Update ResetPasswordComponent (`{ error }`-derived messages)
    - Send `{ email, code, new_password }`, require a non-blank code (Req 12.2), an 8–72 password (Req 12.4), and a matching confirmation (Req 12.5); enforce client-side validation as a hard gate so a validation failure sends NO `POST` to the ConfirmForgotPassword_Endpoint (Req 12.3); on success navigate to `/auth/login` with a success message (Req 12.6); replace the hard-coded message with `AuthError.message`, distinguishing invalid/expired code where the backend reports it (Req 12.7) from any other error (Req 12.8)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 8.3 Update SetPasswordComponent (respond-to-challenge)
    - Retain `session` + `email` from `history.state` (Req 13.1), validate password 8–72 (Req 13.2) and confirmation match (Req 13.3); block submission at the UI level (disable submit control or prevent form submission) when password validation fails (Req 13.4); call `respondToChallenge` (Req 13.5), which persists tokens/expires_in (Req 13.6) and roles + authenticated state (Req 13.7); navigate to the post-login destination on success (Req 13.8), and show the `{ error }`-derived message on error (Req 13.9); connectivity failures surface as status 0 (Req 13.10); keep the redirect to login when session/email context is missing
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [ ]* 8.4 Write unit tests for recovery/challenge component navigation and messages
    - ForgotPassword: generic confirmation + navigation to reset-password (Req 11.3, 11.4)
    - ResetPassword: navigation to login + success message on success, `{ error }`-derived message on error (Req 12.5)
    - SetPassword: state carry-through and post-login navigation on success (Req 13.1, 13.7)
    - _Requirements: 11.3, 11.4, 12.5, 13.1, 13.7_

- [x] 9. Final checkpoint - full flows wired
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements for traceability, and each property-test sub-task explicitly references its design Property number and the requirements it validates.
- Static type declarations (Req 2.1, 3.1, 5.1, 6.1) are enforced at compile time; deterministic status→message mappings and one-off navigation flows are covered by unit tests rather than properties.
- All 22 design properties are covered exactly once across tasks 2.2, 2.3, 2.4, 4.4, 4.5, and 4.6. Each property-based test must use `fast-check` with `{ numRuns: 100 }` minimum and be tagged `// Feature: auth-backend-integration, Property {n}: {text}`.
- Fault-injection resilience behaviors that are not per-input universals are covered by example/unit tests in task 4.8: partial-success token storage on login (Req 2.3), logout completing locally when the request cannot be sent (Req 9.4), and the malformed/corrupted Error_Body fallback (Req 7.2).
- Checkpoints ensure incremental validation via `ng test`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.5", "3.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "2.6", "3.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5", "4.6", "4.7", "4.8", "6.1", "7.1", "8.1", "8.2", "8.3"] },
    { "id": 4, "tasks": ["6.2", "7.2"] },
    { "id": 5, "tasks": ["6.3", "7.3", "8.4"] }
  ]
}
```
