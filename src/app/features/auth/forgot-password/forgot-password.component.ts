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

@Component({
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /**
   * Generic, enumeration-safe confirmation shown on any outcome. It never
   * reveals whether the submitted email is associated with an account
   * (Req 11.5, 11.6).
   */
  private static readonly GENERIC_CONFIRMATION =
    'Si el email existe, se envió un código de recuperación.';

  infoMessage = '';

  readonly isLoading = this.authService.isLoading;

  readonly form = this.fb.nonNullable.group({
    // required() blocks blank email; email() blocks overlong (>254) and
    // otherwise-invalid addresses (Req 11.2, 11.3).
    email: ['', [AuthValidators.required(), AuthValidators.email()]],
  });

  submit(): void {
    this.infoMessage = '';

    // Hard gate: an invalid (blank/overlong/malformed) email blocks submission
    // independently of whether a validation message is displayed (Req 11.3).
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        // Show a generic enumeration-safe confirmation and navigate to the
        // reset page carrying the email (Req 11.4, 11.5).
        this.infoMessage = ForgotPasswordComponent.GENERIC_CONFIRMATION;
        this.router.navigate(['/auth/reset-password'], { state: { email } });
      },
      error: () => {
        // The error is mapped from the { error } body in AuthService, but the
        // visible message stays generic to avoid account enumeration (Req 11.6).
        this.infoMessage = ForgotPasswordComponent.GENERIC_CONFIRMATION;
      },
    });
  }
}
