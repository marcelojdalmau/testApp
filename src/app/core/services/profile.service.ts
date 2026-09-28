import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { API_BASE_URL } from '../config/api.config';
import { ProfileResponse } from '../models/profile.model';
import { mapHttpErrorToAuthError } from './http-error.util';

/**
 * Obtiene el perfil del usuario autenticado tras el inicio de sesión (Req 4).
 *
 * El token de acceso lo adjunta el interceptor de autenticación existente; este
 * servicio no manipula tokens.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /**
   * Consulta el Profile_Endpoint y devuelve el perfil autenticado (Req 4.1, 4.2).
   *
   * Aplica un tope de conectividad de 10s (Req 4.3): un vencimiento se normaliza a
   * un `HttpErrorResponse` de estado 0 para que `mapHttpErrorToAuthError` produzca
   * el mismo `AuthError` de conectividad. Cualquier otro error del backend se mapea
   * al `AuthError` correspondiente (Req 4.4).
   *
   * Ruta asumida [CONFIRMAR CON BACKEND]: `GET {API_BASE_URL}/users/me`.
   */
  fetchProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiBaseUrl}/users/me`).pipe(
      timeout(10_000),
      catchError((error: unknown) => {
        const httpError =
          error instanceof HttpErrorResponse
            ? error
            : new HttpErrorResponse({ status: 0, error });
        return throwError(() => mapHttpErrorToAuthError(httpError));
      }),
    );
  }
}
