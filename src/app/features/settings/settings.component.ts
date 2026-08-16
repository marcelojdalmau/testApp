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

import { ThemeService, ThemeSkin } from '../../core/services/theme.service';

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

  // Custom color signals
  customPrimary = signal(this.getComputedColor('--sh-primary'));
  customAccent = signal(this.getComputedColor('--sh-accent'));

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

  selectSkin(skinId: ThemeSkin): void {
    this.themeService.setSkin(skinId);
    // Reset custom colors to match the new skin
    setTimeout(() => {
      this.customPrimary.set(this.getComputedColor('--sh-primary'));
      this.customAccent.set(this.getComputedColor('--sh-accent'));
    }, 50);
  }

  onPrimaryChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customPrimary.set(value);
  }

  onAccentChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customAccent.set(value);
  }

  applyColors(): void {
    this.themeService.applyCustomPalette({
      primary: this.customPrimary(),
      primaryLight: this.lightenColor(this.customPrimary(), 20),
      accent: this.customAccent(),
      accentLight: this.lightenColor(this.customAccent(), 20),
    });
  }

  resetColors(): void {
    this.themeService.resetPalette();
    setTimeout(() => {
      this.customPrimary.set(this.getComputedColor('--sh-primary'));
      this.customAccent.set(this.getComputedColor('--sh-accent'));
    }, 50);
  }

  private getComputedColor(varName: string): string {
    if (typeof document === 'undefined') return '#000000';
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    // If it's already a hex, return it. Otherwise try to convert rgb
    if (value.startsWith('#')) return value;
    if (value.startsWith('rgb')) {
      const match = value.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return value || '#000000';
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}
