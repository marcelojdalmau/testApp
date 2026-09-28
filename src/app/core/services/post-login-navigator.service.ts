import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, throwError, TimeoutError } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';

import { AuthError } from '../models/auth.model';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { CompletenessResult, ProfileCompletenessService } from './profile-completeness.service';

/**
 * Orquesta el flujo posterior al inicio de sesión: obtener perfil → resolver
 * completitud → navegar (Req 4, 6, 7).
 *
 * Es un servicio reutilizable (no un componente) invocado tanto por
 * `LoginComponent` (login sin reto) como por `SetPasswordComponent` (tras
 * `respondToChallenge`), garantizando comportamiento idéntico en ambos flujos
 * (Req 7.1).
 */
@Injectable({ providedIn: 'root' })
export class PostLoginNavigator {
  private readonly profile = inject(ProfileService);
  private readonly resolver = inject(ProfileCompletenessService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Ejecuta la secuencia obtener perfil → resolver → navegar.
   *
   * Devuelve un `Observable<void>` que completa cuando la navegación se ha
   * decidido. En caso de **fallo al obtener el perfil** (conectividad, error de
   * backend o timeout de 10s del propio `fetchProfile`, que llega como
   * `AuthError`), el observable emite un error con ese `AuthError` para que el
   * componente muestre el mensaje y **permanezca en la pantalla de login**, sin
   * navegar (Req 4.3, 4.4).
   *
   * En caso de **fallo o vencimiento de la resolución** (el tope global de 5s de
   * este pipe, o la marca `errored` del resolver), navega a `/profile/complete`
   * con el aviso de que no se pudo determinar el destino, manteniendo la sesión
   * activa (Req 6.5, 7.3).
   */
  navigateAfterLogin(): Observable<void> {
    return this.profile.fetchProfile().pipe(
      // Tope global de resolución (Req 6.5 / 7.3). Un vencimiento aquí se trata
      // como fallo de resolución, no como fallo de fetch.
      timeout(5_000),
      map((res) => this.resolver.resolve(res.profile, res.profile_complete)),
      tap((result) => this.route(result)),
      map(() => void 0),
      catchError((error: unknown) => this.handleFailure(error)),
    );
  }

  /**
   * Calcula el Post_Login_Destination a partir de la completitud y la URL de
   * retorno (Req 6.1–6.4).
   *
   * - Incompleto → `clearReturnUrl()` y navegar a `/profile/complete`, que tiene
   *   prioridad sobre cualquier URL de retorno (Req 6.2, 6.4).
   * - Completo → navegar a la URL de retorno si existe, si no a `/feed`
   *   (Req 6.1, 6.3).
   *
   * Un resultado con `errored: true` (fallo de la evaluación de completitud) se
   * degrada de forma segura al mismo destino que un perfil incompleto, con el
   * aviso correspondiente (Req 5.7, 6.5).
   */
  private route(result: CompletenessResult): void {
    if (result.errored) {
      this.routeToProfileCompletionWithNotice();
      return;
    }

    if (result.status === 'incomplete') {
      // El flujo de completar perfil tiene prioridad sobre la URL de retorno (Req 6.4).
      this.auth.clearReturnUrl();
      this.router.navigate(['/profile/complete']);
      return;
    }

    // Perfil completo: respetar la URL de retorno si existe (Req 6.3), si no /feed (Req 6.1).
    const returnUrl = this.auth.getReturnUrl();
    if (returnUrl) {
      this.auth.clearReturnUrl();
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate(['/feed']);
    }
  }

  /**
   * Discrimina el origen del error para decidir entre permanecer en login o
   * degradar hacia el flujo de completar perfil.
   *
   * - **Fallo de fetch** (`AuthError` propagado por `ProfileService`) → se
   *   re-propaga para que el componente muestre el mensaje y permanezca en login
   *   (Req 4.3, 4.4).
   * - **Fallo/timeout de resolución** (el `TimeoutError` del tope global de 5s)
   *   → navegar a `/profile/complete` con aviso, manteniendo la sesión activa
   *   (Req 6.5, 7.3).
   */
  private handleFailure(error: unknown): Observable<void> {
    if (this.isFetchFailure(error)) {
      return throwError(() => error as AuthError);
    }
    // Fallo de resolución (timeout global de 5s u otro fallo tras obtener el perfil).
    this.routeToProfileCompletionWithNotice();
    return of(void 0);
  }

  /**
   * Un fallo de fetch es el `AuthError` que emite `ProfileService.fetchProfile()`
   * (conectividad, error de backend o su propio timeout de 10s). Se reconoce por
   * su forma (`statusCode` numérico). El `TimeoutError` del tope global de 5s NO
   * es un fallo de fetch, sino de resolución.
   */
  private isFetchFailure(error: unknown): boolean {
    if (error instanceof TimeoutError) {
      return false;
    }
    return (
      typeof error === 'object' &&
      error !== null &&
      typeof (error as AuthError).statusCode === 'number'
    );
  }

  /**
   * Degradación segura ante fallo de resolución: navegar al flujo de completar
   * perfil y avisar que no se pudo determinar el destino (Req 6.5, 7.3). La
   * sesión autenticada permanece activa; no se toca ningún token.
   */
  private routeToProfileCompletionWithNotice(): void {
    this.router.navigate(['/profile/complete'], {
      state: { notice: 'No se pudo determinar el destino.' },
    });
  }
}
