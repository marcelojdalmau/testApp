import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth.service';
import { AuthValidators } from '../../../core/validators/auth.validators';
import { AuthError, RegisterRequest } from '../../../core/models/auth.model';
import { SocialAuthService } from '../../../core/services/social/social-auth.service';
import { SocialProvider } from '../../../core/models/social-auth.model';

/**
 * Descriptor de un botón de proveedor social: el identificador del proveedor y
 * su nombre visible/accesible. El logotipo se renderiza en la plantilla.
 */
interface SocialProviderButton {
  readonly provider: SocialProvider;
  readonly label: string;
}

@Component({
  selector: 'app-register',
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
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly socialAuthService = inject(SocialAuthService);

  readonly isLoading = this.authService.isLoading;

  hidePassword = true;
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  /**
   * Estado del control de consentimiento ("¿Qué datos solicitamos?"): controla
   * el desplegado de la lista de datos solicitados (correo y nombre) y su
   * finalidad (Requisitos 9.3, 9.4).
   */
  readonly showConsent = signal(false);

  /**
   * Botones de proveedor a renderizar (nombre + logotipo). Se presentan siempre
   * los tres proveedores en las tres plataformas (Requisitos 2.1, 7.1-7.3); en
   * iOS, Apple está SIEMPRE presente junto a Google/Facebook (Guideline 4.8,
   * Requisito 7.4). No se muestra ningún selector de tenant/institución
   * (Requisito 10.4).
   */
  readonly socialProviders: readonly SocialProviderButton[] = [
    { provider: 'google', label: 'Google' },
    { provider: 'facebook', label: 'Facebook' },
    { provider: 'apple', label: 'Apple' },
  ];

  // Formulario reducido a correo + contraseña + confirmación (Req 1.1, 1.2).
  // Los validadores existentes cubren las reglas de Req 1.3–1.7: `email` valida
  // formato y longitud ≤254; `password` valida el rango 8–72; `matchField`
  // valida la coincidencia con la confirmación.
  readonly form = this.fb.nonNullable.group({
    email: ['', [AuthValidators.required(), AuthValidators.email()]],
    password: ['', [AuthValidators.required(), AuthValidators.password()]],
    confirmPassword: ['', [AuthValidators.required(), AuthValidators.matchField('password')]],
  });

  register(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Solo se envían `email` y `password`; la confirmación no viaja al backend (Req 2.5).
    const { email, password } = this.form.getRawValue();
    const payload: RegisterRequest = { email, password };

    this.authService.register(payload).subscribe({
      // 201: mensaje de confirmación de cuenta creada (Req 3.1). Al ser éxito,
      // sí se puede resetear el formulario por completo.
      next: () => {
        this.successMessage.set(
          'Cuenta creada. Revisá tu email para verificar tu cuenta.',
        );
        this.form.reset();
      },
      // Ramas de error (Req 3.2, 3.3, 3.5): NO se resetea el formulario; se
      // preservan los valores ingresados (notablemente el correo) y se limpia
      // únicamente la contraseña y su confirmación.
      error: (error: AuthError) => {
        this.errorMessage.set(this.mapError(error));
        this.clearPasswordFields();
      },
    });
  }

  /**
   * Limpia únicamente los campos de contraseña y confirmación, conservando el
   * resto de los valores del formulario tras una rama de error (Req 3.2, 3.3,
   * 3.5). Se marcan como intactos para no disparar mensajes de validación por
   * el mero hecho de vaciarlos.
   */
  private clearPasswordFields(): void {
    this.form.controls.password.reset('');
    this.form.controls.confirmPassword.reset('');
  }

  /**
   * Alterna la visibilidad del panel de consentimiento sobre los datos
   * solicitados (Requisitos 9.3, 9.4).
   */
  toggleConsent(): void {
    this.showConsent.update((visible) => !visible);
  }

  /**
   * Inicia el flujo de registro/inicio de sesión social para el proveedor
   * indicado, reutilizando exactamente el mismo flujo que el login
   * (`startSocialLogin`, Requisito 2.4). El signal `isLoading` (gestionado por
   * el flujo social) deshabilita los tres botones y muestra el indicador de
   * carga; ante un error, el flujo lo libera y se rehabilitan los botones,
   * mostrando el mensaje en español (Requisitos 2.6, 5.7).
   */
  startSocialLogin(provider: SocialProvider): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    void this.socialAuthService.startSocialLogin(provider).catch((error) => {
      // Un fallo al iniciar el flujo (p. ej. antes del redirect) se refleja
      // como mensaje en español y libera el estado de carga. El caso de correo
      // no compartido (Req 2.7) y demás errores del intercambio se surften a
      // través del callback; aquí se muestra el mensaje si llega directo.
      const mapped = this.socialAuthService.mapError(error);
      // La cancelación no produce mensaje de error (mapError devuelve null).
      if (mapped) {
        this.errorMessage.set(mapped.message);
      }
      this.authService.setLoading(false);
    });
  }

  /**
   * Mapea el `AuthError` del registro a un mensaje en español (Req 3.2–3.6):
   * - 409: el correo ya está registrado (Req 3.2).
   * - 400: mensaje de validación derivado del `Error_Body`, con fallback
   *   genérico cuando el cuerpo está vacío o es ilegible (Req 3.3, 3.4).
   * - 500: error genérico de servidor (Req 3.5).
   * - 0: error de conectividad (Req 3.6).
   * El caso 404 "institución" se eliminó por dejar de aplicar tras la reforma.
   */
  private mapError(error: AuthError): string {
    switch (error?.statusCode) {
      case 409:
        return 'El email ya está registrado.';
      case 403:
        return 'El registro no está permitido.';
      case 400:
        return error.message || 'Datos inválidos. Revisá el formulario.';
      case 500:
        return 'Ocurrió un problema en el servidor. Intentá de nuevo más tarde.';
      case 0:
        return 'No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.';
      default:
        return error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.';
    }
  }
}
