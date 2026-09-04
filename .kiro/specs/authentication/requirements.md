# Requirements Document

## Introduction

This document specifies the requirements for the Authentication feature of the Sora Sport Angular 20 frontend application. The feature provides a complete authentication flow including login, self-registration, forgot/reset password, and invited-user password setup. All authentication operations delegate to a Python backend that integrates with AWS Cognito for identity management. The frontend communicates with the backend via REST API endpoints and manages token storage, session state, and route protection client-side.

## Glossary

- **Auth_Service**: The Angular injectable service responsible for managing authentication state, token storage, and HTTP calls to the backend auth endpoints.
- **Auth_Interceptor**: The Angular HTTP interceptor that attaches access tokens to outgoing API requests and handles 401 responses by attempting token refresh.
- **Auth_Guard**: The Angular route guard that prevents unauthenticated users from accessing protected routes and redirects them to the login page.
- **Login_Component**: The Angular standalone component that renders the login form and handles form submission.
- **Register_Component**: The Angular standalone component that renders the self-registration form and handles form submission.
- **Forgot_Password_Component**: The Angular standalone component that renders the form for requesting a password reset code.
- **Reset_Password_Component**: The Angular standalone component that renders the form for entering a reset code and new password.
- **Set_Password_Component**: The Angular standalone component that renders the form for invited users to set their permanent password after receiving a temporary one.
- **Token_Pair**: The set of tokens returned by the backend on successful login: access_token, id_token, refresh_token, and expires_in.
- **Tenant_ID**: A required identifier representing the institution/organization context for authentication operations.
- **NEW_PASSWORD_REQUIRED_Challenge**: The Cognito authentication challenge returned when an invited user logs in with a temporary password and must set a permanent one.

## Requirements

### Requirement 1: User Login

**User Story:** As a registered user, I want to log in with my email, password, and tenant context, so that I can access the application with my assigned roles.

#### Acceptance Criteria

1. WHEN the user submits valid email, password, and tenant_id, THE Login_Component SHALL send a POST request to `/auth/login` with the provided credentials.
2. WHEN the backend returns a successful response with a Token_Pair and roles, THE Auth_Service SHALL store the access_token, id_token, refresh_token, and expires_in in secure client-side storage.
3. WHEN login succeeds, THE Auth_Service SHALL store the user roles returned by the backend.
4. WHEN login succeeds and no NEW_PASSWORD_REQUIRED_Challenge is returned, THE Login_Component SHALL navigate the user to the main application feed route.
5. WHEN the backend returns a 401 status, THE Login_Component SHALL display an "Invalid credentials" error message to the user.
6. WHEN the backend returns a 403 status, THE Login_Component SHALL display an "Account is not active" error message to the user.
7. THE Login_Component SHALL validate that email, password, and tenant_id fields are non-empty before submitting the form.
8. THE Login_Component SHALL validate that the email field contains a valid email format before submission.
9. THE Login_Component SHALL validate that the password field contains between 8 and 72 characters before submission.
10. WHILE a login request is in progress, THE Login_Component SHALL disable the submit button and display a loading indicator.
11. WHEN the backend returns a NEW_PASSWORD_REQUIRED_Challenge (invited user with temporary password), THE Login_Component SHALL navigate the user to the Set_Password_Component with the session context needed to complete the challenge.

### Requirement 2: User Self-Registration

**User Story:** As a new user, I want to register with my email, password, full name, and tenant context, so that I can create an account and verify my email.

#### Acceptance Criteria

1. WHEN the user submits valid email, password, full_name, tenant_id, and optional account_type, THE Register_Component SHALL send a POST request to `/auth/register` with the provided data.
2. WHEN the backend returns a 201 status with "pending_confirmation" status, THE Register_Component SHALL display a success message informing the user to check their email for verification.
3. WHEN the backend returns a 409 status, THE Register_Component SHALL display an error message indicating the email is already registered.
4. WHEN the backend returns a 400 status, THE Register_Component SHALL display the validation error message returned by the backend.
5. WHEN the backend returns a 403 status, THE Register_Component SHALL display an error message indicating self-registration is not allowed for the selected institution.
6. WHEN the backend returns a 404 status, THE Register_Component SHALL display an error message indicating the institution was not found.
7. THE Register_Component SHALL validate that email, password, full_name, and tenant_id are non-empty before submission.
8. THE Register_Component SHALL validate that the email field contains a valid email format before submission.
9. THE Register_Component SHALL validate that the password field contains between 8 and 72 characters before submission.
10. THE Register_Component SHALL require a password confirmation field and validate it matches the password before submission.
11. WHILE a registration request is in progress, THE Register_Component SHALL disable the submit button and display a loading indicator.

### Requirement 3: Forgot Password

**User Story:** As a user who forgot my password, I want to request a password reset code, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN the user submits a valid email, THE Forgot_Password_Component SHALL send a POST request to `/auth/forgot-password` with the email address.
2. WHEN the backend returns a successful response, THE Forgot_Password_Component SHALL navigate the user to the Reset_Password_Component and pass the email as context.
3. WHEN the backend returns an error status, THE Forgot_Password_Component SHALL display a generic message indicating that if the email exists a code has been sent, to avoid revealing account existence.
4. THE Forgot_Password_Component SHALL validate that the email field is non-empty and contains a valid email format before submission.
5. WHILE a forgot-password request is in progress, THE Forgot_Password_Component SHALL disable the submit button and display a loading indicator.

### Requirement 4: Reset Password (Confirm Forgot Password)

**User Story:** As a user who received a reset code, I want to enter the code and a new password, so that I can set a new password for my account.

#### Acceptance Criteria

1. WHEN the user submits a valid code and new password, THE Reset_Password_Component SHALL send a POST request to `/auth/confirm-forgot-password` with the email, code, and new_password.
2. WHEN the backend returns a successful response, THE Reset_Password_Component SHALL display a success message and navigate the user to the login page.
3. WHEN the backend returns an error indicating an invalid or expired code, THE Reset_Password_Component SHALL display an error message indicating the code is invalid or expired.
4. THE Reset_Password_Component SHALL validate that the code field is non-empty before submission.
5. THE Reset_Password_Component SHALL validate that the new password field contains between 8 and 72 characters before submission.
6. THE Reset_Password_Component SHALL require a password confirmation field and validate it matches the new password before submission.
7. WHILE a reset-password request is in progress, THE Reset_Password_Component SHALL disable the submit button and display a loading indicator.
8. THE Reset_Password_Component SHALL pre-populate the email from the context passed by the Forgot_Password_Component.

### Requirement 5: Invited User Password Setup (NEW_PASSWORD_REQUIRED Challenge)

**User Story:** As an invited user logging in for the first time, I want to set my permanent password, so that I can replace the temporary password and access the application.

#### Acceptance Criteria

1. WHEN the Set_Password_Component receives the session context from the login challenge, THE Set_Password_Component SHALL display a form for the user to enter a new password.
2. WHEN the user submits a valid new password, THE Set_Password_Component SHALL send a POST request to `/auth/respond-to-challenge` with the session, email, and new_password.
3. WHEN the backend returns a successful response with a Token_Pair and roles, THE Auth_Service SHALL store the tokens and roles, and THE Set_Password_Component SHALL navigate the user to the main application feed route.
4. WHEN the backend returns an error, THE Set_Password_Component SHALL display the error message returned by the backend.
5. THE Set_Password_Component SHALL validate that the new password field contains between 8 and 72 characters before submission.
6. THE Set_Password_Component SHALL require a password confirmation field and validate it matches the new password before submission.
7. WHILE a challenge response request is in progress, THE Set_Password_Component SHALL disable the submit button and display a loading indicator.
8. IF the Set_Password_Component is accessed without valid session context, THEN THE Set_Password_Component SHALL redirect the user to the login page.

### Requirement 6: Token Management and Auto-Refresh

**User Story:** As an authenticated user, I want my session to remain active transparently, so that I do not have to re-login while actively using the application.

#### Acceptance Criteria

1. WHEN an HTTP request receives a 401 response and a refresh_token exists in storage, THE Auth_Interceptor SHALL send a POST request to `/auth/refresh` with the refresh_token.
2. WHEN the refresh endpoint returns new tokens, THE Auth_Service SHALL update the stored access_token, id_token, and expires_in.
3. WHEN the refresh endpoint returns new tokens, THE Auth_Interceptor SHALL retry the original failed request with the new access_token.
4. IF the refresh endpoint returns a 401 status (invalid or expired refresh token), THEN THE Auth_Service SHALL clear all stored tokens and navigate the user to the login page.
5. THE Auth_Interceptor SHALL attach the stored access_token as a Bearer token in the Authorization header of all outgoing API requests to the backend.
6. THE Auth_Interceptor SHALL exclude authentication endpoints (login, register, forgot-password, confirm-forgot-password, respond-to-challenge) from token attachment.
7. IF no access_token is stored and a protected API request is attempted, THEN THE Auth_Interceptor SHALL cancel the request and navigate the user to the login page.

### Requirement 7: Logout

**User Story:** As an authenticated user, I want to log out of the application, so that my session is terminated and my tokens are invalidated.

#### Acceptance Criteria

1. WHEN the user triggers logout, THE Auth_Service SHALL send a POST request to `/auth/logout` with the stored access_token.
2. WHEN the logout request completes (regardless of success or failure), THE Auth_Service SHALL clear all stored tokens, roles, and user state from client-side storage.
3. WHEN the logout process completes, THE Auth_Service SHALL navigate the user to the login page.

### Requirement 8: Route Protection

**User Story:** As a product owner, I want unauthenticated users to be blocked from accessing protected routes, so that application content is only available to logged-in users.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to navigate to a protected route, THE Auth_Guard SHALL cancel the navigation and redirect the user to the login page.
2. WHEN an unauthenticated user is redirected to login, THE Auth_Guard SHALL preserve the originally requested URL so the user can be redirected back after login.
3. WHEN login succeeds and a stored return URL exists, THE Login_Component SHALL navigate to the stored return URL instead of the default feed route.
4. THE Auth_Guard SHALL consider a user authenticated when a valid access_token exists in storage.

### Requirement 9: HttpClient Configuration

**User Story:** As a developer, I want the Angular application to have HttpClient properly configured with the auth interceptor, so that all HTTP communication works correctly with the backend.

#### Acceptance Criteria

1. THE Application SHALL provide HttpClient via `provideHttpClient` with the Auth_Interceptor registered as a functional interceptor using `withInterceptors`.
2. THE Application SHALL configure a base API URL that all auth service requests use as a prefix for endpoint paths.
3. IF an HTTP request fails due to a network error, THEN THE Auth_Service SHALL surface an appropriate error message to the calling component.
