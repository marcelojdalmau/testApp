import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8000',
});

/**
 * Tenant por defecto opcional para el registro.
 *
 * Por defecto es `null`: sin tenant configurado. `AuthService.register()` solo
 * incluye `tenant_id` en el cuerpo de la petición cuando este token resuelve a
 * un valor no vacío; con `null` (o cadena vacía) el campo `tenant_id` no se envía.
 * Esto hace reversible por configuración el fallback del Register_Endpoint sin
 * exponer un campo `tenant_id` en el formulario (Req 2.6).
 */
export const DEFAULT_TENANT_ID = new InjectionToken<string | null>('DEFAULT_TENANT_ID', {
  providedIn: 'root',
  factory: () => null,
});
