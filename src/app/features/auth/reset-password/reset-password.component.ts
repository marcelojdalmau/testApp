import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth.service';
import { AuthValidators } from '../../../core/validators/auth.validators';
import { AuthError } from '../../../core/models/auth.model';

@Component({
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly email: string;

  successMessage = '';
  errorMessage = '';

  readonly isLoading = this.authService.isLoading;

  readonly form = this.fb.nonNullable.group({
    code: ['', [AuthValidators.required()]],
    new_password: ['', [AuthValidators.required(), AuthValidators.password()]],
    confirmPassword: ['', [AuthValidators.required(), AuthValidators.matchField('new_password')]],
  });

  constructor() {
    // Prefer history.state since getCurrentNavigation() is only available during navigation.
    const nav = this.router.getCurrentNavigation();
    this.email =
      nav?.extras?.state?.['email'] ?? history.state?.['email'] ?? '';
  }

  submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { code, new_password } = this.form.getRawValue();

    this.authService
      .confirmForgotPassword({ email: this.email, code, new_password })
      .subscribe({
        next: () => {
          this.successMessage = 'Tu contraseña se actualizó correctamente.';
          this.router.navigate(['/auth/login']);
        },
        error: (error: AuthError) => {
          this.errorMessage = this.mapError(error);
        },
      });
  }

  /**
   * Traduce el `AuthError` normalizado por `AuthService` (extraído del campo
   * `error` del Error_Body) al mensaje visible en español. Un código inválido o
   * expirado (Requisito 12.7) y cualquier otro error (Requisito 12.8) se derivan
   * ambos de `AuthError.message`; el fallback distingue el caso de código para
   * mantener el mensaje accionable cuando el backend no aporta uno legible.
   */
  private mapError(error: AuthError): string {
    if (error?.statusCode === 400) {
      return error?.message || 'El código es inválido o expiró.';
    }

    return error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}
