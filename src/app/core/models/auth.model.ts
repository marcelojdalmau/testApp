export interface TokenPair {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
  roles: string[];
  challenge?: 'NEW_PASSWORD_REQUIRED';
  session?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  account_type?: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  message: string;
}

export interface ConfirmForgotPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface ChallengeResponse {
  session: string;
  email: string;
  new_password: string;
}

export interface RefreshResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
}

export interface AuthError {
  statusCode: number;
  message: string;
  error?: string;
}
