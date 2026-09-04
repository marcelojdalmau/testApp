# Implementation Plan: Authentication

## Overview

Replace the existing mock `AuthService` and template-driven login/register components with a production-ready authentication layer. This includes token management, reactive forms, functional interceptor/guard, and five auth page components — all communicating with the Python backend via REST endpoints.

## Tasks

- [x] 1. Set up core infrastructure and data models
  - [x] 1.1 Create auth data models and API configuration
    - Create `src/app/core/models/auth.model.ts` with all interfaces: `TokenPair`, `LoginRequest`, `LoginResponse`, `RegisterRequest`, `RegisterResponse`, `ConfirmForgotPasswordRequest`, `ChallengeResponse`, `RefreshResponse`, `AuthError`
    - Create `src/app/core/config/api.config.ts` with `API_BASE_URL` InjectionToken (default: `http://localhost:8000`)
    - Register `API_BASE_URL` provider in `app.config.ts`
    - _Requirements: 9.2_

  - [x] 1.2 Create TokenStorageService
    - Create `src/app/core/services/token-storage.service.ts`
    - Implement `storeTokens`, `getAccessToken`, `getRefreshToken`, `getIdToken`, `clearTokens`
    - Implement `storeRoles`, `getRoles`, `clearRoles`
    - Implement `storeReturnUrl`, `getReturnUrl`, `clearReturnUrl`
    - Implement `clearAll` method
    - Use localStorage keys: `sora-sport-auth-tokens`, `sora-sport-auth-roles`, `sora-sport-return-url`
    - _Requirements: 1.2, 6.2, 8.2_

  - [x] 1.3 Write property test for TokenStorageService round-trip
    - **Property 4: Token storage round-trip**
    - Install `fast-check` as dev dependency
    - For any valid `TokenPair` object, storing and retrieving SHALL return original values
    - **Validates: Requirements 1.2, 6.2**

  - [x] 1.4 Create AuthValidators utility class
    - Create `src/app/core/validators/auth.validators.ts`
    - Implement `email()` validator: simplified RFC 5322, max 254 chars
    - Implement `password()` validator: 8-72 characters length
    - Implement `matchField(fieldName)` validator: confirm password match
    - Implement `required()` validator: non-empty after trim
    - _Requirements: 1.7, 1.8, 1.9, 2.7, 2.8, 2.9, 2.10, 3.4, 4.4, 4.5, 4.6, 5.5, 5.6_

  - [x] 1.5 Write property tests for AuthValidators
    - **Property 1: Email validation rejects all invalid formats**
    - **Property 2: Password validation boundary enforcement**
    - **Property 3: Password confirmation match**
    - **Validates: Requirements 1.8, 1.9, 2.8, 2.9, 2.10, 3.4, 4.5, 4.6, 5.5, 5.6**

- [x] 2. Implement AuthService
  - [x] 2.1 Rewrite AuthService with signals and HTTP backend calls
    - Replace mock `src/app/core/services/auth.service.ts` with production implementation
    - Inject `HttpClient`, `Router`, `TokenStorageService`, and `API_BASE_URL`
    - Expose signals: `isAuthenticated`, `userRoles`, `isLoading`
    - Implement `login(credentials: LoginRequest): Observable<LoginResponse>`
    - Implement `register(data: RegisterRequest): Observable<RegisterResponse>`
    - Implement `forgotPassword(email: string): Observable<void>`
    - Implement `confirmForgotPassword(data: ConfirmForgotPasswordRequest): Observable<void>`
    - Implement `respondToChallenge(data: ChallengeResponse): Observable<LoginResponse>`
    - Implement `refreshToken(): Observable<RefreshResponse>`
    - Implement `logout(): void` — POST to `/auth/logout`, clear all tokens/roles/state, navigate to login
    - Implement return URL helpers: `getReturnUrl()`, `clearReturnUrl()`, `storeReturnUrl(url)`
    - Map HTTP errors to typed `AuthError` objects
    - _Requirements: 1.1-1.6, 2.1-2.6, 3.1-3.3, 4.1-4.3, 5.2-5.4, 6.1-6.4, 7.1-7.3_

  - [x] 2.2 Write unit tests for AuthService
    - Mock `HttpClient` to verify correct endpoints, request bodies, and headers
    - Test signal state transitions on login success/failure
    - Test token storage on successful login
    - Test logout clears all state
    - Test error mapping for 401, 403, 409, network errors
    - _Requirements: 1.1-1.6, 7.1-7.3_

  - [x] 2.3 Write property test for logout state clearing
    - **Property 7: Logout clears all stored state**
    - After `AuthService.logout()`, all token and role storage SHALL be empty and `isAuthenticated` SHALL be false
    - **Validates: Requirements 7.2**

- [x] 3. Implement authInterceptor and authGuard
  - [x] 3.1 Create functional authInterceptor
    - Create `src/app/core/interceptors/auth.interceptor.ts`
    - Implement `authInterceptor: HttpInterceptorFn`
    - Skip token attachment for auth endpoints: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/confirm-forgot-password`, `/auth/respond-to-challenge`
    - Attach `Authorization: Bearer <token>` to all other requests
    - On 401: attempt single refresh, retry original request with new token
    - Queue concurrent requests during refresh using shared `Subject`
    - On refresh failure: clear tokens, navigate to login
    - If no token exists for protected request: cancel and navigate to login
    - _Requirements: 6.1-6.7_

  - [x] 3.2 Create functional authGuard
    - Create `src/app/core/guards/auth.guard.ts`
    - Implement `authGuard: CanActivateFn`
    - Return `true` if `AuthService.isAuthenticated()` is `true`
    - Otherwise store attempted URL via `AuthService.storeReturnUrl()` and redirect to `/auth/login`
    - _Requirements: 8.1-8.4_

  - [x] 3.3 Register interceptor and guard in app configuration
    - Update `app.config.ts` to add `provideHttpClient(withInterceptors([authInterceptor]))`
    - Update `app.routes.ts` to apply `authGuard` to the main app routes (the `LayoutComponent` route)
    - _Requirements: 9.1, 8.1_

  - [x] 3.4 Write property tests for authInterceptor
    - **Property 5: Auth interceptor skips auth endpoints**
    - **Property 6: Auth interceptor attaches token to non-auth requests**
    - **Validates: Requirements 6.5, 6.6**

  - [x] 3.5 Write property test for authGuard return URL preservation
    - **Property 8: Auth guard preserves return URL on redirect**
    - For any URL attempted by an unauthenticated user, the guard SHALL store that URL before redirecting
    - **Validates: Requirements 8.2**

- [x] 4. Checkpoint - Core services verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement auth page components
  - [x] 5.1 Rewrite LoginComponent with reactive forms
    - Replace template-driven form in `src/app/features/auth/login/` with `ReactiveFormsModule`
    - Create typed `FormGroup` with fields: email, password, tenant_id
    - Apply `AuthValidators.email()`, `AuthValidators.password()`, `AuthValidators.required()`
    - Call `AuthService.login()` on submit
    - Handle success: store tokens/roles, navigate to return URL or `/feed`
    - Handle NEW_PASSWORD_REQUIRED challenge: navigate to `/auth/set-password` with session context
    - Handle errors: display mapped error messages (401 → "Invalid credentials", 403 → "Account is not active")
    - Show loading indicator and disable button while request is in progress
    - _Requirements: 1.1-1.11, 8.3_

  - [x] 5.2 Rewrite RegisterComponent with reactive forms
    - Replace template-driven form in `src/app/features/auth/register/` with `ReactiveFormsModule`
    - Create typed `FormGroup` with fields: email, password, confirmPassword, full_name, tenant_id, account_type (optional)
    - Apply `AuthValidators.email()`, `AuthValidators.password()`, `AuthValidators.matchField('password')`, `AuthValidators.required()`
    - Call `AuthService.register()` on submit
    - Handle 201 success: display "check email for verification" message
    - Handle errors: 409 → "Email already registered", 403 → "Self-registration not allowed", 404 → "Institution not found", 400 → backend message
    - Show loading indicator and disable button while request is in progress
    - _Requirements: 2.1-2.11_

  - [x] 5.3 Create ForgotPasswordComponent
    - Create `src/app/features/auth/forgot-password/` directory and component files
    - Standalone component with reactive form: email field
    - Apply `AuthValidators.email()` and `AuthValidators.required()`
    - Call `AuthService.forgotPassword()` on submit
    - On success: navigate to `/auth/reset-password` passing email as state
    - On error: display generic "if email exists, code was sent" message (no account enumeration)
    - Show loading indicator and disable button while request is in progress
    - _Requirements: 3.1-3.5_

  - [x] 5.4 Create ResetPasswordComponent
    - Create `src/app/features/auth/reset-password/` directory and component files
    - Standalone component with reactive form: code, new_password, confirmPassword
    - Pre-populate email from navigation state (passed by ForgotPasswordComponent)
    - Apply `AuthValidators.required()` for code, `AuthValidators.password()` for new_password, `AuthValidators.matchField('new_password')` for confirm
    - Call `AuthService.confirmForgotPassword()` on submit
    - On success: display success message, navigate to login
    - On error: display "code is invalid or expired" message
    - Show loading indicator and disable button while request is in progress
    - _Requirements: 4.1-4.8_

  - [x] 5.5 Create SetPasswordComponent
    - Create `src/app/features/auth/set-password/` directory and component files
    - Standalone component with reactive form: new_password, confirmPassword
    - Receive session context (session, email) from navigation state (passed by LoginComponent on NEW_PASSWORD_REQUIRED challenge)
    - If no valid session context: redirect to login
    - Apply `AuthValidators.password()` and `AuthValidators.matchField('new_password')`
    - Call `AuthService.respondToChallenge()` on submit
    - On success: store tokens/roles, navigate to `/feed`
    - On error: display backend error message
    - Show loading indicator and disable button while request is in progress
    - _Requirements: 5.1-5.8_

  - [x] 5.6 Update auth routes
    - Update `src/app/features/auth/auth.routes.ts` to add routes for `forgot-password`, `reset-password`, and `set-password`
    - Remove `role-select` and `create-profile` routes (replaced by new auth flow)
    - _Requirements: 3.2, 4.2, 5.1_

- [x] 6. Checkpoint - Full feature verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Write component unit tests
  - [x] 7.1 Write unit tests for LoginComponent
    - Test form validation states (required, email format, password length)
    - Test submit button disabled when form invalid or loading
    - Test error message display for 401 and 403 responses
    - Test navigation to feed on success
    - Test navigation to set-password on NEW_PASSWORD_REQUIRED challenge
    - _Requirements: 1.5-1.11_

  - [x] 7.2 Write unit tests for RegisterComponent
    - Test form validation states including confirmPassword match
    - Test submit button disabled when form invalid or loading
    - Test success message display on 201
    - Test error messages for 409, 403, 404, 400 responses
    - _Requirements: 2.2-2.11_

  - [x] 7.3 Write unit tests for ForgotPasswordComponent, ResetPasswordComponent, SetPasswordComponent
    - Test form validation and submission flows
    - Test navigation between forgot → reset → login
    - Test SetPasswordComponent redirect when no session context
    - _Requirements: 3.1-3.5, 4.1-4.8, 5.1-5.8_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing mock `AuthService` and template-driven components will be replaced in-place
- The `role-select` and `create-profile` flows are removed as the new auth design delegates onboarding to the backend

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.5"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "5.5", "5.6"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3"] }
  ]
}
```
