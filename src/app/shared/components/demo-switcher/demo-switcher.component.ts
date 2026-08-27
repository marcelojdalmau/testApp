import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../../core/services/auth.service';
import { AnyUserProfile, InstitutionProfile, ManagementProfile } from '../../../core/models/user.model';
import { MOCK_ATHLETES } from '../../../mock-data/athletes.data';
import { MOCK_HEALTH_PROFESSIONALS, MOCK_COACHES } from '../../../mock-data/professionals.data';

interface DemoUser {
  label: string;
  sublabel: string;
  profile: AnyUserProfile;
}

@Component({
  selector: 'app-demo-switcher',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatButtonModule, MatIconModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="demoMenu" matTooltip="Cambiar usuario demo">
      <mat-icon>swap_horiz</mat-icon>
    </button>
    <mat-menu #demoMenu="matMenu">
      <div class="demo-menu-header">Cambiar usuario demo</div>
      @for (user of demoUsers; track user.label) {
        <button mat-menu-item (click)="switchTo(user.profile)">
          <mat-icon>{{ getIcon(user.profile.role) }}</mat-icon>
          <div class="demo-menu-item">
            <span class="demo-name">{{ user.label }}</span>
            <span class="demo-role">{{ user.sublabel }}</span>
          </div>
        </button>
      }
    </mat-menu>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .demo-menu-header {
      padding: 8px 16px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sh-on-surface-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .demo-menu-item {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .demo-name {
      font-size: 0.9rem;
      font-weight: 500;
    }
    .demo-role {
      font-size: 0.75rem;
      color: var(--sh-on-surface-secondary);
    }
  `]
})
export class DemoSwitcherComponent {
  private authService = inject(AuthService);

  demoUsers: DemoUser[] = [
    { label: 'Lucas Martínez', sublabel: 'Deportista - Fútbol', profile: MOCK_ATHLETES[0] },
    { label: 'Sofía Gutiérrez', sublabel: 'Deportista - Hockey', profile: MOCK_ATHLETES[1] },
    { label: 'Dra. Martina Pérez', sublabel: 'Nutricionista', profile: MOCK_HEALTH_PROFESSIONALS[0] },
    { label: 'Roberto Silva', sublabel: 'Preparador Físico', profile: MOCK_HEALTH_PROFESSIONALS[1] },
    { label: 'Carlos Medina', sublabel: 'DT - Fútbol', profile: MOCK_COACHES[0] },
    {
      label: 'Racing Club',
      sublabel: 'Institución',
      profile: {
        id: 'club_001',
        email: 'info@racingclub.com',
        fullName: 'Racing Club',
        role: 'institution',
        discipline: 'football',
        location: 'Avellaneda, Buenos Aires',
        createdAt: new Date('2023-01-01'),
        institutionType: 'club',
        foundedYear: 1903,
        facilities: ['Estadio', 'Predio'],
        memberCount: 85000,
      } as InstitutionProfile,
    },
    {
      label: 'Agencia Deportiva',
      sublabel: 'Gestión / Marcas',
      profile: {
        id: 'mgmt_001',
        email: 'contacto@agenciadeportiva.com',
        fullName: 'Agencia Deportiva Sur',
        role: 'management',
        discipline: 'football',
        location: 'Buenos Aires, Argentina',
        createdAt: new Date('2023-06-01'),
        managementType: 'agent',
        company: 'Agencia Deportiva Sur',
      } as ManagementProfile,
    },
  ];

  getIcon(role: string): string {
    switch (role) {
      case 'athlete': return 'directions_run';
      case 'health-professional': return 'medical_services';
      case 'coach': return 'sports';
      case 'institution': return 'stadium';
      case 'management': return 'business_center';
      default: return 'person';
    }
  }

  switchTo(profile: AnyUserProfile): void {
    this.authService.switchUser(profile);
    window.location.href = '/feed';
  }
}
