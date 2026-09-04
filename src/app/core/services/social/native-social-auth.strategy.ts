import { Injectable, InjectionToken, inject } from '@angular/core';

import { COGNITO_CONFIG } from '../../config/cognito.config';
import {
  SocialAuthorizeRequest,
  SocialAuthorizeResult,
} from '../../models/social-auth.model';
import {
  SocialAuthStrategy,
  SOCIAL_AUTH_SCOPES,
} from './social-auth-strategy';
import { NATIVE_AUTH_BROWSER } from './native-auth-browser';

/**
 * Esquema/deep link de redirección usado por las apps nativas para recibir el
 * callback del proveedor (`redirect_uri` en el flujo OAuth).
 */
export const NATIVE_SOCIAL_REDIRECT_URI = new InjectionToken<string>(
  'NATIVE_SOCIAL_REDIRECT_URI',
  {
    providedIn: 'root',
    factory: () => 'com.sorasport://auth',
  },
);

/**
 * Estrategia de autenticación social para plataformas nativas (Android e iOS).
 *
 * Construye la URL `authorize` de Cognito (OAuth 2.0 Authorization Code + PKCE)
 * y delega la apertura del navegador de autenticación en la costura
 * {@link NATIVE_AUTH_BROWSER}, que aísla la integración concreta con la capa
 * nativa (iOS `ASWebAuthenticationSession` / Android Chrome Custom Tabs). De
 * este modo, ni esta clase ni el resto del código dependen del contenedor o
 * plugin nativo empleado.
 *
 * Requisitos: 7.2, 7.3, 9.1, 9.2.
 */
@Injectable({ providedIn: 'root' })
export class NativeSocialAuthStrategy implements SocialAuthStrategy {
  private readonly browser = inject(NATIVE_AUTH_BROWSER);
  private readonly redirectUri = inject(NATIVE_SOCIAL_REDIRECT_URI);
  private readonly cognito = inject(COGNITO_CONFIG);

  /**
   * `redirect_uri` propio de la plataforma nativa: el esquema/deep link
   * (`com.sorasport://auth`) al que el proveedor redirige tras autenticar.
   */
  getRedirectUri(): string {
    return this.redirectUri;
  }

  /**
   * Abre el flujo del proveedor en el navegador de autenticación nativo y
   * resuelve con `{ code, state }` en éxito o con `status: 'cancelled'` cuando
   * la persona cierra el navegador. Cualquier fallo inesperado se mapea a
   * `status: 'error'` sin establecer sesión.
   */
  async authorize(
    request: SocialAuthorizeRequest,
  ): Promise<SocialAuthorizeResult> {
    const authorizeUrl = this.buildAuthorizeUrl(request);

    try {
      const result = await this.browser.open(authorizeUrl, this.redirectUri);

      if (result.status === 'cancelled') {
        return { status: 'cancelled' };
      }

      return this.parseCallback(result.url, request.state);
    } catch {
      return {
        status: 'error',
        errorMessage: 'No se pudo completar la autenticación.',
      };
    }
  }

  /**
   * Construye la URL `authorize` de Cognito con PKCE, `state`, `redirect_uri`
   * nativo y los scopes limitados exactamente a correo y nombre (Req 9.1/9.2).
   */
  private buildAuthorizeUrl(request: SocialAuthorizeRequest): string {
    const scopes = [SOCIAL_AUTH_SCOPES.email, SOCIAL_AUTH_SCOPES.name].join(' ');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.cognito.clientId,
      redirect_uri: this.redirectUri,
      identity_provider: this.toCognitoIdentityProvider(request.provider),
      scope: scopes,
      state: request.state,
      code_challenge: request.code_challenge,
      code_challenge_method: 'S256',
    });

    return `${this.cognito.domain}/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Extrae `code` y `state` de la URL de callback recibida por el deep link y
   * valida que el `state` coincida con el del intento para prevenir CSRF.
   */
  private parseCallback(
    callbackUrl: string | undefined,
    expectedState: string,
  ): SocialAuthorizeResult {
    if (!callbackUrl) {
      return { status: 'cancelled' };
    }

    let params: URLSearchParams;
    try {
      params = new URL(callbackUrl).searchParams;
    } catch {
      return {
        status: 'error',
        errorMessage: 'Respuesta de autenticación no válida.',
      };
    }

    if (params.get('error')) {
      return {
        status: 'error',
        errorMessage: 'No se pudo completar la autenticación.',
      };
    }

    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state || state !== expectedState) {
      return {
        status: 'error',
        errorMessage: 'No se pudo completar la autenticación.',
      };
    }

    return { status: 'success', code, state };
  }

  /**
   * Mapea el proveedor social al nombre del proveedor de identidad configurado
   * en Cognito.
   */
  private toCognitoIdentityProvider(
    provider: SocialAuthorizeRequest['provider'],
  ): string {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'facebook':
        return 'Facebook';
      case 'apple':
        return 'SignInWithApple';
    }
  }
}
