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
  selector: 'app-set-password',
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
  templateUrl: './set-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './set-password.component.scss',
})
export class SetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  hidePassword = true;
  hideConfirmPassword = true;
  errorMessage = '';

  readonly isLoading = this.authService.isLoading;

  private readonly session: string;
  private readonly email: string;

  readonly form = this.fb.nonNullable.group({
    new_password: ['', [AuthValidators.required(), AuthValidators.password()]],
    confirmPassword: ['', [AuthValidators.required(), AuthValidators.matchField('new_password')]],
  });

  constructor() {
    const state = (history.state ?? {}) as { session?: string; email?: string };
    this.session = state.session ?? '';
    this.email = state.email ?? '';

    // Requirement 5.8: without valid session context, redirect to login.
    if (!this.session || !this.email) {
      this.router.navigate(['/auth/login']);
    }
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.session || !this.email) {
      this.router.navigate(['/auth/login']);
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { new_password } = this.form.getRawValue();

    this.authService
      .respondToChallenge({ session: this.session, email: this.email, new_password })
      .subscribe({
        next: () => {
          this.router.navigate(['/feed']);
        },
        error: (error: AuthError) => {
          this.errorMessage = error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.';
        },
      });
  }
}
