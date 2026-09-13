# Requirements Document

## Introduction

The Sport backend now exposes concrete authentication endpoints for login, registration, token refresh, logout, forgot-password, confirm-forgot-password, and respond-to-challenge. The Angular frontend (built during the prior `authentication` spec) was wired against assumed contracts that no longer match the real backend. This feature reconciles the frontend authentication layer with the verified backend contracts.

Specifically, this spec aligns request and response models (adding `default_tenant_id` to login, adding the required `tenant_id` to register), standardizes backend error message extraction to the `{ "error": "<message>" }` shape, and configures the correct API base URL. The backend now provides three additional public endpoints — `POST /auth/forgot-password`, `POST /auth/confirm-forgot-password`, and `POST /auth/respond-to-challenge` — exposed without an authorizer (same as `POST /auth/login`) and backed by the same `AuthFn` Lambda, which is granted the Cognito actions `ForgotPassword`, `ConfirmForgotPassword`, and `RespondToAuthChallenge`. The password-recovery flows (forgot-password, reset-password) and the `NEW_PASSWORD_REQUIRED` login challenge flow are therefore in scope and supported.

The scope is limited to connecting the seven existing backend endpoints correctly and aligning the frontend request and response models to their verified contracts. No new backend behavior is defined here.

## Glossary

- **Frontend**: The Angular Sport frontend application located at `Sport_fe`.
- **AuthService**: The Angular service (`src/app/core/services/auth.service.ts`) responsible for issuing authentication HTTP requests and managing authentication state.
- **TokenStorageService**: The Angular service that persists tokens, roles, and related authentication state.
- **LoginPage**: The login page component (`src/app/features/auth/login/login.component.ts`).
- **RegisterPage**: The registration page component (`src/app/features/auth/register/register.component.ts`).
- **Login_Endpoint**: The backend endpoint `POST /auth/login`.
- **Register_Endpoint**: The backend endpoint `POST /auth/register`.
- **Refresh_Endpoint**: The backend endpoint `POST /auth/refresh`.
- **Logout_Endpoint**: The backend endpoint `POST /auth/logout`.
- **ForgotPassword_Endpoint**: The public backend endpoint `POST /auth/forgot-password`, which initiates a password reset by sending a Reset_Code to the user's email (Cognito `ForgotPassword`).
- **ConfirmForgotPassword_Endpoint**: The public backend endpoint `POST /auth/confirm-forgot-password`, which completes a password reset using the emailed Reset_Code and a new password (Cognito `ConfirmForgotPassword`).
- **RespondToChallenge_Endpoint**: The public backend endpoint `POST /auth/respond-to-challenge`, which responds to an Auth_Challenge such as `NEW_PASSWORD_REQUIRED` (Cognito `RespondToAuthChallenge`).
- **ForgotPasswordPage**: The forgot-password page component (`ForgotPasswordComponent`) served at the `/auth/forgot-password` route.
- **ResetPasswordPage**: The reset-password page component (`ResetPasswordComponent`) served at the `/auth/reset-password` route.
- **SetPasswordPage**: The set-password page component (`SetPasswordComponent`) served at the `/auth/set-password` route.
- **API_Base_URL**: The configured base URL used to construct backend endpoint paths (`src/app/core/config/api.config.ts`).
- **Error_Body**: The backend error response body, which has the shape `{ "error": "<message>" }`.
- **Default_Tenant_Id**: The `default_tenant_id` value returned by the Login_Endpoint on success.
- **Tenant_Id**: A tenant identifier formatted as a UUID.
- **Reset_Code**: The one-time code emailed to a user by the ForgotPassword_Endpoint, submitted to the ConfirmForgotPassword_Endpoint to complete a password reset.
- **Auth_Challenge**: A login challenge returned by the Login_Endpoint that requires an additional step before authentication completes, such as `NEW_PASSWORD_REQUIRED`.
- **Challenge_Session**: The opaque `session` token returned by the Login_Endpoint alongside an Auth_Challenge, submitted to the RespondToChallenge_Endpoint to complete the challenge.

## Requirements

### Requirement 1: Login request contract alignment

**User Story:** As a returning user, I want the frontend to send the login request in the format the backend expects, so that I can authenticate successfully.

#### Acceptance Criteria

1. WHEN the LoginPage submits credentials, THE AuthService SHALL send a `POST` request to the Login_Endpoint with a body containing exactly the fields `email` and `password`.
2. THE AuthService SHALL exclude any `tenant_id` field from the Login_Endpoint request body.
3. IF the submitted email exceeds 254 characters, THEN THE LoginPage SHALL prevent submission and display a validation message.
4. IF the submitted email is empty, THEN THE LoginPage SHALL prevent submission and display a validation message.
5. IF the submitted password is shorter than 8 characters or longer than 72 characters, THEN THE LoginPage SHALL prevent submission and display a validation message.

### Requirement 2: Login response contract alignment

**User Story:** As a returning user, I want the frontend to correctly read the login response, so that my session and default tenant are established.

#### Acceptance Criteria

1. THE Frontend SHALL define the login response model with the fields `access_token`, `id_token`, `refresh_token`, `expires_in`, `default_tenant_id`, and `roles`.
2. WHEN the Login_Endpoint returns a 200 response, THE AuthService SHALL store `access_token`, `id_token`, `refresh_token`, and `expires_in` through the TokenStorageService.
3. IF storing an individual token through the TokenStorageService fails, THEN THE AuthService SHALL store the tokens that can be stored successfully and SHALL NOT treat the login as failed solely because of the storage failure.
4. WHEN the Login_Endpoint returns a 200 response, THE AuthService SHALL store the `roles` value through the TokenStorageService.
5. WHEN the Login_Endpoint returns a 200 response, THE AuthService SHALL persist the `default_tenant_id` value through the TokenStorageService.
6. WHEN the Login_Endpoint returns a 200 response, THE AuthService SHALL set the authenticated state to true.

### Requirement 3: Login challenge handling

**User Story:** As a user whose account requires a password change, I want login to route me to the set-password screen when the backend reports a challenge, so that I can complete authentication instead of hitting a dead end.

#### Acceptance Criteria

1. THE Frontend SHALL define the login response model with an optional `challenge` field and an optional `session` field in addition to the token fields.
2. WHEN the Login_Endpoint returns a 200 response that does not include a `challenge` value, THE LoginPage SHALL treat the response as a completed authentication and navigate to the post-login destination.
3. WHEN the Login_Endpoint returns a `NEW_PASSWORD_REQUIRED` `challenge` value, THE LoginPage SHALL navigate to the SetPasswordPage and carry the `session` value and the submitted `email` to that page.
4. THE LoginPage SHALL treat navigation to the SetPasswordPage as a supported continuation of the login flow rather than a terminal error.

### Requirement 4: Login error handling

**User Story:** As a user with a login problem, I want to see an accurate message explaining why login failed, so that I can correct the issue.

#### Acceptance Criteria

1. THE LoginPage SHALL associate each login error status code with its designated message as specified in the criteria below, such that displaying a status code's designated message satisfies the corresponding acceptance criterion.
2. IF the Login_Endpoint returns a 401 response, THEN THE LoginPage SHALL display a message indicating the credentials are invalid.
3. IF the Login_Endpoint returns a 403 response, THEN THE LoginPage SHALL display a message indicating the account is not active.
4. IF the Login_Endpoint returns a 400 response, THEN THE LoginPage SHALL display a validation error message derived from the Error_Body.
5. IF the Login_Endpoint returns a 500 response, THEN THE LoginPage SHALL display a generic error message.
6. IF the login request cannot reach the backend, THEN THE AuthService SHALL return an error with status code 0 and a connectivity message.

### Requirement 5: Register request contract alignment with required tenant_id

**User Story:** As a new user, I want the registration request to include all fields the backend requires, so that my account is created under the correct tenant.

#### Acceptance Criteria

1. THE Frontend SHALL define the register request model with the fields `email`, `password`, `full_name`, and `tenant_id`, and an optional `account_type` field.
2. WHEN the RegisterPage submits a registration, THE AuthService SHALL send a `POST` request to the Register_Endpoint with a body including `email`, `password`, `full_name`, and `tenant_id`.
3. THE RegisterPage SHALL collect a Tenant_Id value for inclusion in the registration request.
4. IF the collected Tenant_Id is not a valid UUID, THEN THE RegisterPage SHALL both prevent submission and display a validation message, such that the block and the message always occur together.
5. IF the submitted `full_name` is empty, THEN THE RegisterPage SHALL prevent submission and display a validation message.
6. IF the submitted `full_name` is a whitespace-only non-empty value or exceeds 200 characters, THEN THE RegisterPage SHALL prevent submission and display a validation message.
7. IF the submitted email exceeds 254 characters, THEN THE RegisterPage SHALL prevent submission and display a validation message.
8. IF the submitted password is shorter than 8 characters or longer than 72 characters, THEN THE RegisterPage SHALL prevent submission and display a validation message.
9. WHERE an `account_type` value is provided, THE AuthService SHALL include `account_type` in the Register_Endpoint request body.

### Requirement 6: Register response and error handling

**User Story:** As a new user, I want clear feedback after registering, so that I know whether my account was created or why it was not.

#### Acceptance Criteria

1. THE Frontend SHALL define the register response model with the fields `user_id`, `email`, `full_name`, `status`, and `message`.
2. WHEN the Register_Endpoint returns a 201 response, THE RegisterPage MAY display a success message to the user, and displaying no message on success is acceptable.
3. IF the Register_Endpoint returns a 409 response, THEN THE RegisterPage SHALL display a message indicating the email is already registered.
4. IF the Register_Endpoint returns a 404 response, THEN THE RegisterPage SHALL display a message indicating the tenant was not found.
5. IF the Register_Endpoint returns a 403 response, THEN THE RegisterPage SHALL display a message indicating registration is not permitted for the tenant.
6. IF the Register_Endpoint returns a 400 response, THEN THE RegisterPage SHALL display a validation error message derived from the Error_Body.

### Requirement 7: Backend error message extraction

**User Story:** As a user, I want error messages that reflect what the backend actually reported, so that displayed errors are accurate.

#### Acceptance Criteria

1. WHEN the AuthService receives an error response containing an Error_Body, THE AuthService SHALL attempt to extract the human-readable message from the `error` field of the Error_Body.
2. IF an Error_Body is present but is malformed or corrupted such that extraction of the `error` field fails, THEN THE AuthService SHALL provide a generic fallback message.
3. IF an error response contains no readable `error` field, THEN THE AuthService SHALL provide a generic fallback message.
4. THE AuthService SHALL populate the auth error model `message` field from the extracted Error_Body `error` value when present.

### Requirement 8: Token refresh contract alignment

**User Story:** As an authenticated user, I want my session to renew silently, so that I stay logged in without re-entering credentials.

#### Acceptance Criteria

1. WHEN a token refresh is requested, THE AuthService SHALL send a `POST` request to the Refresh_Endpoint with a body containing the field `refresh_token`.
2. WHEN the Refresh_Endpoint returns a 200 response AND any of the `access_token`, `id_token`, or `expires_in` values has changed, THE AuthService SHALL update each of those stored values whose value has changed.
3. WHEN the Refresh_Endpoint returns a 200 response, THE AuthService SHALL retain the existing refresh token value.
4. IF the Refresh_Endpoint returns a 401 response, THEN THE AuthService SHALL clear all stored authentication state and route the user to the login page.
5. IF a refresh is requested with a missing refresh token, THEN THE AuthService SHALL treat the attempt as an authentication failure and route the user to the login page.

### Requirement 9: Logout contract alignment

**User Story:** As an authenticated user, I want to log out cleanly, so that my session is ended locally regardless of backend availability.

#### Acceptance Criteria

1. WHEN the user logs out, THE AuthService SHALL send a `POST` request to the Logout_Endpoint with a body containing the field `access_token`.
2. WHEN the Logout_Endpoint returns a 204 response, THE AuthService SHALL clear all stored authentication state.
3. IF the Logout_Endpoint returns any error response, THEN THE AuthService SHALL clear all stored authentication state.
4. IF the logout request cannot be sent to the Logout_Endpoint, THEN THE AuthService SHALL clear all stored authentication state locally and route the user to the login page.
5. WHEN logout completes, THE AuthService SHALL route the user to the login page.

### Requirement 10: API base URL configuration

**User Story:** As an operator, I want the frontend to target the correct backend base URL, so that authentication requests reach the running backend.

#### Acceptance Criteria

1. THE Frontend SHALL construct every authentication endpoint path using the API_Base_URL configuration value.
2. WHERE no environment-specific override is provided, THE Frontend SHALL default the API_Base_URL to the local backend address.
3. THE Frontend SHALL allow the API_Base_URL to be overridden by environment configuration without code changes to the AuthService.

### Requirement 11: Forgot-password flow

**User Story:** As a user who forgot my password, I want to request a reset code by email, so that I can begin recovering access to my account.

#### Acceptance Criteria

1. WHEN the user submits an email on the ForgotPasswordPage, THE AuthService SHALL send a `POST` request to the ForgotPassword_Endpoint with a body containing exactly the field `email`.
2. IF the submitted email is blank or exceeds 254 characters, THEN THE ForgotPasswordPage SHALL prevent submission and display a validation message.
3. IF the submitted email is invalid, THEN THE ForgotPasswordPage SHALL prevent submission independently of whether a validation message is displayed.
4. WHEN the ForgotPassword_Endpoint returns a success response, THE ForgotPasswordPage SHALL navigate the user to the ResetPasswordPage.
5. WHEN the ForgotPassword_Endpoint returns a success response, THE ForgotPasswordPage SHALL display a generic confirmation message that does not reveal whether the submitted email is associated with an existing account.
6. IF the ForgotPassword_Endpoint returns an error response, THEN THE ForgotPasswordPage SHALL display a message derived from the `error` field of the Error_Body, and displaying this error message concurrently with navigation to the ResetPasswordPage is acceptable.
7. IF the forgot-password request cannot reach the backend, THEN THE AuthService SHALL return an error with status code 0 and a connectivity message.

### Requirement 12: Confirm-forgot-password (reset) flow

**User Story:** As a user who received a reset code, I want to submit the code with a new password, so that I can set a new password and regain access.

#### Acceptance Criteria

1. WHEN the user submits the reset form on the ResetPasswordPage, THE AuthService SHALL send a `POST` request to the ConfirmForgotPassword_Endpoint with a body containing exactly the fields `email`, `code`, and `new_password`.
2. IF the submitted Reset_Code is blank, THEN THE ResetPasswordPage SHALL prevent submission and display a validation message.
3. IF client-side validation on the ResetPasswordPage fails, THEN THE ResetPasswordPage SHALL block the request such that no `POST` request is sent to the ConfirmForgotPassword_Endpoint.
4. IF the submitted `new_password` is shorter than 8 characters or longer than 72 characters, THEN THE ResetPasswordPage SHALL prevent submission and display a validation message.
5. IF the submitted `new_password` does not match the confirmation value, THEN THE ResetPasswordPage SHALL prevent submission and display a validation message.
6. WHEN the ConfirmForgotPassword_Endpoint returns a success response, THE ResetPasswordPage SHALL navigate the user to the LoginPage and display a success message, even if form validation errors were bypassed.
7. IF the ConfirmForgotPassword_Endpoint returns an error response indicating an invalid or expired code, THEN THE ResetPasswordPage SHALL display a message derived from the `error` field of the Error_Body indicating the code is invalid or expired.
8. IF the ConfirmForgotPassword_Endpoint returns any other error response, THEN THE ResetPasswordPage SHALL display a message derived from the `error` field of the Error_Body.

### Requirement 13: Respond-to-challenge (set-password) flow

**User Story:** As a user prompted to set a new password during login, I want to submit a new password to complete the challenge, so that my authentication finishes and I am signed in.

#### Acceptance Criteria

1. WHEN the SetPasswordPage is opened from a `NEW_PASSWORD_REQUIRED` login challenge, THE SetPasswordPage SHALL retain the Challenge_Session value and the `email` value carried from the LoginPage.
2. IF the submitted `new_password` is shorter than 8 characters or longer than 72 characters, THEN THE SetPasswordPage SHALL prevent submission and display a validation message.
3. IF the submitted `new_password` does not match the confirmation value, THEN THE SetPasswordPage SHALL prevent submission and display a validation message.
4. IF password validation on the SetPasswordPage fails, THEN THE SetPasswordPage SHALL block submission at the UI level by disabling the submit control or preventing the form submission.
5. WHEN the user submits a new password on the SetPasswordPage, THE AuthService SHALL send a `POST` request to the RespondToChallenge_Endpoint with a body containing exactly the fields `session`, `email`, and `new_password`.
6. WHEN the RespondToChallenge_Endpoint returns a success response, THE AuthService SHALL store the returned `access_token`, `id_token`, `refresh_token`, and `expires_in` values through the TokenStorageService.
7. WHEN the RespondToChallenge_Endpoint returns a success response, THE AuthService SHALL store the returned `roles` value through the TokenStorageService and set the authenticated state to true.
8. WHEN the RespondToChallenge_Endpoint returns a success response, THE SetPasswordPage SHALL navigate to the post-login destination.
9. IF the RespondToChallenge_Endpoint returns an error response, THEN THE SetPasswordPage SHALL display a message derived from the `error` field of the Error_Body.
10. IF the respond-to-challenge request cannot reach the backend, THEN THE AuthService SHALL return an error with status code 0 and a connectivity message.
