import { InjectionToken } from '@angular/core';
import {
  SocialAuthorizeRequest,
  SocialAuthorizeResult,
} from '../../models/social-auth.model';

/**
 * Abstracción de estrategia de autenticación social por plataforma.
 *
 * Desacopla la orquestación (`SocialAuthService`) de los detalles concretos de
 * cada plataforma:
 * - Web: construye la URL `authorize` de Cognito y redirige; el resultado llega
 *   por el `Social_Callback_Handler`, no por el valor de retorno.
 * - Native: abre un in-app browser y resuelve con `{ code, state }` o una
 *   cancelación cuando la persona cierra el navegador.
 */
export interface SocialAuthStrategy {
  /**
   * Abre el flujo del proveedor. En Web redirige (no retorna); en Native
   * resuelve con el resultado del callback.
   */
  authorize(request: SocialAuthorizeRequest): Promise<SocialAuthorizeResult>;

  /**
   * redirect_uri propio de la plataforma
   * (web: `origin + /auth/callback`; native: esquema/deep link).
   */
  getRedirectUri(): string;
}

/**
 * Token de inyección para resolver la `SocialAuthStrategy` según la plataforma
 * de ejecución. La resolución SIEMPRE devuelve una estrategia no nula para
 * `web`, `android` e `ios` (Requisito 7).
 */
export const SOCIAL_AUTH_STRATEGY = new InjectionToken<SocialAuthStrategy>(
  'SOCIAL_AUTH_STRATEGY',
);

/**
 * Alcances (scopes) de perfil solicitados a cada proveedor. Se limitan
 * exclusivamente a correo electrónico y nombre, sin ningún otro campo de
 * perfil, para reutilizarlos de forma consistente en todas las estrategias
 * (Requisitos 9.1 y 9.2).
 */
export const SOCIAL_AUTH_SCOPES = {
  email: 'email',
  name: 'name',
} as const;
