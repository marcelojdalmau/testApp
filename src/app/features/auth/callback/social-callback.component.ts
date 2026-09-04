import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { SocialAuthService } from '../../../core/services/social/social-auth.service';
import { AuthError } from '../../../core/models/auth.model';

/**
 * Mensaje de UI (en español) para un error genérico del proveedor cuando el
 * backend/estrategia no aporta uno más específico.
 */
const PROVIDER_ERROR_MESSAGE =
  'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.';

/**
 * Componente de callback del flujo de autenticación social (sólo Web).
 *
 * Montado en la ruta `/auth/callback`, recibe el redireccionamiento de vuelta
 * desde el proveedor tras el flujo OAuth. Lee `code` y `state` de los query
 * params y:
 *
 * - Si el proveedor devolvió `error=access_denied`, trata el caso como una
 *   cancelación: vuelve a `/auth/login` sin mensaje de error (Req 5.1).
 * - Si hay otro `error`/`error_description`, o falta `code`/`state`, trata el
 *   caso como error: vuelve a `/auth/login` con el mensaje correspondiente
 *   (Req 5.2).
 * - En el caso normal, invoca `socialAuthService.handleCallback(code, state)`
 *   mientras muestra un spinner. La navegación de éxito la resuelve el propio
 *   `handleCallback`; ante error, redirige a `/auth/login` con el mensaje.
 */
@Component({
  selector: 'app-social-callback',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-container">
      <div class="auth-card callback-card">
        <mat-icon class="logo-icon">sports_soccer</mat-icon>
        <mat-progress-spinner
          diameter="48"
          mode="indeterminate"
        ></mat-progress-spinner>
        <p class="callback-text">Completando el inicio de sesión…</p>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 16px;
        background-color: var(--sh-background);
      }

      .callback-card {
        width: 100%;
        max-width: 420px;
        background-color: var(--sh-surface);
        border-radius: var(--sh-radius-lg);
        padding: 40px 32px;
        box-shadow: 0 4px 24px var(--sh-shadow);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }

      .logo-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--sh-accent);
      }

      .callback-text {
        color: var(--sh-on-surface-secondary);
        font-size: 0.9rem;
        margin: 0;
        text-align: center;
      }
    `,
  ],
})
export class SocialCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly socialAuthService = inject(SocialAuthService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const code = params.get('code');
    const state = params.get('state');

    // Cancelación por la persona usuaria: vuelve a login sin mensaje de error
    // y sin alterar el estado previo (Req 5.1).
    if (error === 'access_denied') {
      this.redirectToLogin();
      return;
    }

    // Cualquier otro error del proveedor o ausencia de code/state se trata como
    // error: vuelve a login con el mensaje correspondiente (Req 5.2).
    if (error || !code || !state) {
      this.redirectToLogin(errorDescription || PROVIDER_ERROR_MESSAGE);
      return;
    }

    // Caso normal: procesa el intercambio. La navegación de éxito la resuelve
    // handleCallback; sólo manejamos el error aquí.
    this.socialAuthService.handleCallback(code, state).subscribe({
      error: (err: AuthError) => {
        this.redirectToLogin(err?.message || PROVIDER_ERROR_MESSAGE);
      },
    });
  }

  /**
   * Redirige a la pantalla de inicio de sesión. Cuando se proporciona un
   * `message`, se pasa como query param `error` para que el `LoginComponent`
   * pueda mostrarlo; una cancelación redirige sin mensaje.
   */
  private redirectToLogin(message?: string): void {
    this.router.navigate(['/auth/login'], {
      queryParams: message ? { error: message } : {},
    });
  }
}
