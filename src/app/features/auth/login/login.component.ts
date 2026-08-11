import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  hidePassword = true;
  errorMessage = '';

  login(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Completá todos los campos.';
      return;
    }

    const success = this.authService.login(this.email, this.password);
    if (success) {
      this.router.navigate(['/feed']);
    } else {
      // No existing user, redirect to register
      this.errorMessage = 'No hay una cuenta registrada. Creá una nueva.';
    }
  }

  socialLogin(provider: string): void {
    // Simulate social login — just redirect to role selection
    this.authService.register(`${provider}@sporthub.demo`, 'Usuario Demo', '');
    this.router.navigate(['/auth/role-select']);
  }
}
