import { Injectable, inject } from '@angular/core';

import { COGNITO_CONFIG } from '../../config/cognito.config';
import {
  SocialAuthorizeRequest,
  SocialAuthorizeResult,
  SocialProvider,
} from '../../models/social-auth.model';
import {
  SOCIAL_AUTH_SCOPES,
  SocialAuthStrategy,
} from './social-auth-strategy';

/**
 * Mapeo de los proveedores de Sora Sport a los `identity_provider` que espera la
 * Hosted UI de Cognito.
 */
const COGNITO_IDENTITY_PROVIDER: Record<SocialProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'SignInWithApple',
};

/**
 * Estrategia de autenticación social para la plataforma Web.
 *
 * Construye la URL `authorize` de Cognito para el flujo OAuth 2.0
 * Authorization Code + PKCE y redirige el navegador a ella. El resultado
 * (`code` + `state`) llega de vuelta por el `Social_Callback_Handler` montado
 * en `/auth/callback`, no por el valor de retorno de `authorize()`.
 */
@Injectable({ providedIn: 'root' })
export class WebSocialAuthStrategy implements SocialAuthStrategy {
  private readonly config = inject(COGNITO_CONFIG);

  /**
   * redirect_uri propio de la plataforma Web: el origen actual más la ruta del
   * componente de callback (`/auth/callback`).
   */
  getRedirectUri(): string {
    return `${window.location.origin}/auth/callback`;
  }

  /**
   * Redirige el navegador a la URL `authorize` de Cognito. No retorna un
   * resultado útil: el flujo continúa cuando Cognito redirige de vuelta al
   * `redirect_uri` con `code` y `state`.
   */
  async authorize(request: SocialAuthorizeRequest): Promise<SocialAuthorizeResult> {
    const url = this.buildAuthorizeUrl(request);
    window.location.assign(url);

    // La redirección abandona la página; este valor no llega a consumirse en
    // la práctica, pero se devuelve para satisfacer el contrato de la interfaz.
    return { status: 'success' };
  }

  /**
   * Construye la URL `authorize` de Cognito con `response_type=code`,
   * `code_challenge` (PKCE), `state`, `redirect_uri` y los scopes limitados
   * exclusivamente a `{ email, name }` (Requisitos 9.1 y 9.2).
   */
  private buildAuthorizeUrl(request: SocialAuthorizeRequest): string {
    const scope = Object.values(SOCIAL_AUTH_SCOPES).join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: request.redirect_uri,
      identity_provider: COGNITO_IDENTITY_PROVIDER[request.provider],
      scope,
      state: request.state,
      code_challenge: request.code_challenge,
      code_challenge_method: 'S256',
    });

    return `${this.config.domain}/oauth2/authorize?${params.toString()}`;
  }
}
