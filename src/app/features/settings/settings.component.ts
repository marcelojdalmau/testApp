import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThemeService } from '../../core/services/theme.service';

interface MembershipPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  icon: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  themeService = inject(ThemeService);

  selectedPlan = signal<string>('pro');

  // Privacy toggles
  showMedicalData = signal(false);
  showPersonalInfo = signal(true);
  showVideos = signal(true);
  showLocation = signal(true);
  allowMessages = signal(true);

  plans: MembershipPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 'Gratis',
      period: '',
      icon: 'person',
      highlighted: false,
      features: [
        'Perfil básico',
        'Buscar profesionales',
        'Mensajes limitados (5/día)',
        'Ver convocatorias',
      ],
    },
    {
      id: 'pro',
      name: 'Profesional',
      price: '$4.999',
      period: '/mes',
      icon: 'star',
      highlighted: true,
      features: [
        'Perfil completo con verificación',
        'Mensajes ilimitados',
        'Publicar convocatorias',
        'Acceso a planes de nutrición y PF',
        'Calendario integrado',
        'Estadísticas de perfil',
      ],
    },
    {
      id: 'institution',
      name: 'Institucional',
      price: '$14.999',
      period: '/mes',
      icon: 'stadium',
      highlighted: false,
      features: [
        'Todo el plan Profesional',
        'Gestión de planteles ilimitados',
        'Panel de asistencia y citaciones',
        'Múltiples usuarios administradores',
        'Soporte prioritario',
        'API de integración',
      ],
    },
  ];

  selectPlan(planId: string): void {
    this.selectedPlan.set(planId);
  }

  toggleDarkMode(): void {
    this.themeService.toggle();
  }
}
