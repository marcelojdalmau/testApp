import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth.service';
import { SocialAuthService } from '../../../core/services/social/social-auth.service';
import { AuthValidators } from '../../../core/validators/auth.validators';
import { AuthError, LoginResponse } from '../../../core/models/auth.model';
import { SocialProvider } from '../../../core/models/social-auth.model';

/**
 * Metadatos de presentación de cada botón de proveedor social. El logotipo se
 * expresa como el nombre de la marca para que la plantilla lo renderice con un
 * indicador visual accesible junto al nombre del proveedor.
 */
interface SocialProviderButton {
  provider: SocialProvider;
  label: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly socialAuthService = inject(SocialAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  hidePassword = true;
  errorMessage = '';

  /** Controla el despliegue del panel de consentimiento (datos solicitados). */
  readonly showConsent = signal(false);

  readonly isLoading = this.authService.isLoading;

  /**
   * Los tres proveedores se renderizan SIEMPRE juntos. Al presentar Apple en la
   * misma interfaz que Google/Facebook se cumple la Guideline 4.8 en iOS sin
   * necesidad de lógica condicional por plataforma (Requisito 7.4).
   */
  readonly socialProviders: readonly SocialProviderButton[] = [
    { provider: 'google', label: 'Google' },
    { provider: 'facebook', label: 'Facebook' },
    { provider: 'apple', label: 'Apple' },
  ];

  readonly form = this.fb.nonNullable.group({
    email: ['', [AuthValidators.required(), AuthValidators.email()]],
    password: ['', [AuthValidators.required(), AuthValidators.password()]],
  });

  constructor() {
    // El Social_Callback_Handler redirige a /auth/login?error=<mensaje> cuando
    // el flujo social falla; se lee una única vez para mostrar el mensaje en
    // español ya mapeado por el servicio (Requisito 1.13).
    const callbackError = this.route.snapshot.queryParamMap.get('error');
    if (callbackError) {
      this.errorMessage = callbackError;
    }
  }

  /**
   * Inicia el flujo de autenticación social del proveedor seleccionado. El
   * signal `isLoading` del `AuthService` se activa dentro del servicio y
   * mantiene deshabilitados los tres botones hasta que finalice (Requisito 1.2,
   * 1.10). Un fallo síncrono al iniciar se traduce a un mensaje en español.
   */
  startSocialLogin(provider: SocialProvider): void {
    this.errorMessage = '';
    void this.socialAuthService.startSocialLogin(provider).catch(() => {
      this.errorMessage = 'No se pudo iniciar la autenticación. Intentá de nuevo.';
    });
  }

  /** Alterna la visibilidad del panel de consentimiento (Requisito 9.3, 9.4). */
  toggleConsent(): void {
    this.showConsent.update((visible) => !visible);
  }

  login(): void {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.authService.login({ email, password }).subscribe({
      next: (response: LoginResponse) => {
        if (response.challenge === 'NEW_PASSWORD_REQUIRED') {
          this.router.navigate(['/auth/set-password'], {
            state: { session: response.session, email },
          });
          return;
        }

        const returnUrl = this.authService.getReturnUrl();
        if (returnUrl) {
          this.authService.clearReturnUrl();
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/feed']);
        }
      },
      error: (error: AuthError) => {
        this.errorMessage = this.mapError(error);
      },
    });
  }

  private mapError(error: AuthError): string {
    switch (error?.statusCode) {
      case 401:
        return 'Credenciales inválidas';
      case 403:
        return 'La cuenta no está activa';
      default:
        return error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.';
    }
  }
}
