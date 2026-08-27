import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ROLE_OPTIONS, RoleOption, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-role-select',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './role-select.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './role-select.component.scss',
})
export class RoleSelectComponent {
  private router = inject(Router);

  roleOptions = ROLE_OPTIONS;
  selectedRole: UserRole | null = null;

  selectRole(option: RoleOption): void {
    this.selectedRole = option.role;
  }

  continue(): void {
    if (this.selectedRole) {
      this.router.navigate(['/auth/create-profile'], {
        queryParams: { role: this.selectedRole }
      });
    }
  }
}
