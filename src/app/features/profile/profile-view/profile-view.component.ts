import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MOCK_ATHLETES } from '../../../mock-data/athletes.data';

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule],
  template: `<p>Redirigiendo al perfil...</p>`,
})
export class ProfileViewComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    const user = this.authService.currentUser() ?? MOCK_ATHLETES[0];
    const role = user.role;

    switch (role) {
      case 'athlete':
        this.router.navigate(['/profile/athlete', user.id]);
        break;
      case 'health-professional':
      case 'coach':
        this.router.navigate(['/profile/professional', user.id]);
        break;
      case 'institution':
        this.router.navigate(['/profile/club', user.id]);
        break;
      default:
        this.router.navigate(['/profile/athlete', user.id]);
    }
  }
}
