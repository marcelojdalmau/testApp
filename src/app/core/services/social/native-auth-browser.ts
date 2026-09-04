import { InjectionToken } from '@angular/core';

/**
 * Resultado de abrir el navegador de autenticación nativo.
 *
 * - `success`: el proveedor redirigió al esquema/deep link con `url`.
 * - `cancelled`: la persona cerró el navegador antes de completar el flujo.
 */
export interface NativeAuthBrowserResult {
  status: 'success' | 'cancelled';
  /** URL de callback recibida vía deep link (sólo en `success`). */
  url?: string;
}

/**
 * Costura (seam) que aísla la integración concreta con el navegador de
 * autenticación de la plataforma nativa.
 *
 * En iOS la implementación real se apoya en `ASWebAuthenticationSession` y en
 * Android en Chrome Custom Tabs, típicamente a través de un contenedor como
 * Capacitor o un plugin equivalente. Ese detalle vive DETRÁS de esta interfaz,
 * de modo que ni `NativeSocialAuthStrategy` ni el resto del código dependen de
 * la capa nativa concreta.
 */
export interface NativeAuthBrowser {
  /**
   * Abre `authorizeUrl` en el navegador de autenticación de la plataforma y
   * resuelve cuando el flujo termina: con la URL de callback (`success`) o con
   * una cancelación cuando la persona cierra el navegador.
   *
   * @param authorizeUrl URL `authorize` del proveedor (con PKCE y `state`).
   * @param callbackScheme Esquema/deep link esperado del callback
   *   (p. ej. `com.sorasport://auth`).
   */
  open(
    authorizeUrl: string,
    callbackScheme: string,
  ): Promise<NativeAuthBrowserResult>;
}

/**
 * Token de inyección para resolver el `NativeAuthBrowser`. La implementación
 * concreta se registra en el arranque de la app nativa (contenedor/plugin).
 * Se provee un valor por defecto que declara la capa nativa como no disponible,
 * para que el código compile y funcione en un contexto donde no hay contenedor
 * nativo (p. ej. build web puro) sin acoplarse a ninguna dependencia externa.
 */
export const NATIVE_AUTH_BROWSER = new InjectionToken<NativeAuthBrowser>(
  'NATIVE_AUTH_BROWSER',
  {
    providedIn: 'root',
    factory: () => new UnavailableNativeAuthBrowser(),
  },
);

/**
 * Implementación por defecto usada cuando no hay contenedor nativo registrado.
 * Trata cualquier apertura como una cancelación limpia, de modo que la
 * estrategia nativa nunca establezca sesión ni lance errores no controlados en
 * entornos sin capa nativa.
 */
export class UnavailableNativeAuthBrowser implements NativeAuthBrowser {
  open(): Promise<NativeAuthBrowserResult> {
    return Promise.resolve({ status: 'cancelled' });
  }
}
