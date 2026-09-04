import { InjectionToken } from '@angular/core';

/**
 * Configuración de la Hosted UI / federación de AWS Cognito necesaria para
 * construir la URL `authorize` del flujo OAuth 2.0 Authorization Code + PKCE.
 *
 * Se expone mediante un token de inyección, siguiendo el mismo patrón que
 * `API_BASE_URL`, para poder sustituirla por entorno o en pruebas.
 */
export interface CognitoConfig {
  /**
   * Dominio de la Hosted UI de Cognito (sin barra final), por ejemplo
   * `https://sorasport.auth.us-east-1.amazoncognito.com`.
   */
  domain: string;

  /**
   * Identificador del cliente de aplicación (App Client) de Cognito.
   */
  clientId: string;
}

export const COGNITO_CONFIG = new InjectionToken<CognitoConfig>(
  'COGNITO_CONFIG',
  {
    providedIn: 'root',
    factory: () => ({
      domain: 'https://sorasport.auth.us-east-1.amazoncognito.com',
      clientId: 'sora-sport-web-client',
    }),
  },
);
