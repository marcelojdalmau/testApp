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
        error: () => {
          this.errorMessage = 'El código es inválido o expiró.';
        },
      });
  }
}
