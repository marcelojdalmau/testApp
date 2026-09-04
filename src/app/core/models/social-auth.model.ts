// Proveedores federados soportados.
export type SocialProvider = 'google' | 'facebook' | 'apple';

// Plataforma de ejecución detectada.
export type SocialPlatform = 'web' | 'android' | 'ios';

// Contrato del intercambio contra el backend.
// POST /auth/social/exchange
export interface SocialExchangeRequest {
  provider: SocialProvider;
  code: string;
  code_verifier: string; // PKCE
  redirect_uri: string;
}
// La respuesta reutiliza LoginResponse (TokenPair + roles [+ challenge?]).

// Contexto pendiente persistido entre el inicio del flujo y el callback.
// Clave de almacenamiento sugerida: 'sora-sport-social-pending'.
export interface SocialAuthPendingContext {
  state: string; // opaco, anti-CSRF y clave de la returnUrl
  code_verifier: string; // PKCE
  provider: SocialProvider;
  return_url: string | null; // ruta interna validada, o null
  created_at: number; // epoch ms, para expiración/limpieza
}

// Petición hacia la estrategia de plataforma.
export interface SocialAuthorizeRequest {
  provider: SocialProvider;
  code_challenge: string;
  state: string;
  redirect_uri: string;
}

// Resultado del flujo del proveedor (relevante en Native; en Web llega por callback).
export interface SocialAuthorizeResult {
  status: 'success' | 'cancelled' | 'error';
  code?: string;
  state?: string;
  errorMessage?: string;
}
