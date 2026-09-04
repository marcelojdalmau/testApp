import { InjectionToken, Provider, inject } from '@angular/core';

import { SocialPlatform } from '../../models/social-auth.model';
import {
  SOCIAL_AUTH_STRATEGY,
  SocialAuthStrategy,
} from './social-auth-strategy';
import { WebSocialAuthStrategy } from './web-social-auth.strategy';
import { NativeSocialAuthStrategy } from './native-social-auth.strategy';

/**
 * Token de inyección que expone la plataforma de ejecución detectada
 * (`web`, `android` o `ios`).
 *
 * Se resuelve mediante una factory por defecto que inspecciona el entorno de
 * ejecución sin acoplarse a ningún contenedor nativo concreto. El arranque de
 * las apps nativas (Android/iOS) puede sobrescribir este valor para forzar la
 * plataforma correspondiente.
 */
export const SOCIAL_PLATFORM = new InjectionToken<SocialPlatform>(
  'SOCIAL_PLATFORM',
  {
    providedIn: 'root',
    factory: detectSocialPlatform,
  },
);

/**
 * Detecta la plataforma de ejecución actual.
 *
 * Por defecto asume `web`: en un build web puro no hay contenedor nativo, y las
 * apps nativas registran su propio valor para {@link SOCIAL_PLATFORM} durante el
 * arranque. La detección devuelve SIEMPRE una plataforma válida del conjunto
 * `{ web, android, ios }`.
 */
export function detectSocialPlatform(): SocialPlatform {
  return 'web';
}

/**
 * Factory que resuelve la {@link SocialAuthStrategy} correspondiente a la
 * plataforma indicada. Garantiza una estrategia NO NULA para las tres
 * plataformas objetivo (`web`, `android`, `ios`): Web usa
 * {@link WebSocialAuthStrategy} y las nativas (Android/iOS) usan
 * {@link NativeSocialAuthStrategy} (Requisitos 7.1, 7.2, 7.3).
 */
export function resolveSocialAuthStrategy(
  platform: SocialPlatform,
  webStrategy: WebSocialAuthStrategy,
  nativeStrategy: NativeSocialAuthStrategy,
): SocialAuthStrategy {
  switch (platform) {
    case 'android':
    case 'ios':
      return nativeStrategy;
    case 'web':
    default:
      return webStrategy;
  }
}

/**
 * Provider del token {@link SOCIAL_AUTH_STRATEGY}. Usa una factory que detecta
 * la plataforma y selecciona la estrategia adecuada, asegurando que siempre se
 * resuelve una estrategia no nula.
 */
export const socialAuthStrategyProvider: Provider = {
  provide: SOCIAL_AUTH_STRATEGY,
  useFactory: () =>
    resolveSocialAuthStrategy(
      inject(SOCIAL_PLATFORM),
      inject(WebSocialAuthStrategy),
      inject(NativeSocialAuthStrategy),
    ),
};
