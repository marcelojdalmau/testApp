import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { AuthService } from '../../../core/services/auth.service';
import {
  UserRole,
  SportDiscipline,
  AthleteLevel,
  HealthProfessionalType,
  CoachType,
  InstitutionType,
  ManagementType,
  AnyUserProfile,
} from '../../../core/models/user.model';

@Component({
  selector: 'app-create-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './create-profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './create-profile.component.scss',
})
export class CreateProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  role: UserRole = 'athlete';

  // Common fields
  discipline: SportDiscipline = 'football';
  location = '';
  bio = '';

  // Athlete fields
  athleteLevel: AthleteLevel = 'amateur';
  position = '';
  currentClub = '';

  // Health professional fields
  specialtyType: HealthProfessionalType = 'nutritionist';
  certifications = '';
  servicesOffered = '';
  priceRange = '';

  // Coach fields
  coachType: CoachType = 'head-coach';
  currentTeam = '';
  experience = '';

  // Institution fields
  institutionType: InstitutionType = 'club';
  foundedYear: number | null = null;
  facilities = '';

  // Management fields
  managementType: ManagementType = 'agent';
  company = '';

  disciplines: { value: SportDiscipline; label: string }[] = [
    { value: 'football', label: 'Fútbol' },
    { value: 'basketball', label: 'Básquet' },
    { value: 'rugby', label: 'Rugby' },
    { value: 'hockey', label: 'Hockey' },
    { value: 'tennis', label: 'Tenis' },
    { value: 'swimming', label: 'Natación' },
    { value: 'running', label: 'Running' },
    { value: 'volleyball', label: 'Vóley' },
    { value: 'boxing', label: 'Boxeo' },
    { value: 'martial-arts', label: 'Artes Marciales' },
    { value: 'cycling', label: 'Ciclismo' },
    { value: 'other', label: 'Otro' },
  ];

  ngOnInit(): void {
    const roleParam = this.route.snapshot.queryParams['role'] as UserRole;
    if (roleParam) {
      this.role = roleParam;
    }
  }

  getRoleTitle(): string {
    switch (this.role) {
      case 'athlete': return 'Perfil de Deportista';
      case 'health-professional': return 'Perfil Profesional de Salud';
      case 'coach': return 'Perfil de Entrenador';
      case 'institution': return 'Perfil de Institución';
      case 'management': return 'Perfil de Gestión';
      default: return 'Completá tu perfil';
    }
  }

  submit(): void {
    const temp = this.authService.getTempRegistration();
    const baseProfile = {
      id: temp?.id || 'user_' + Math.random().toString(36).substring(2, 11),
      email: temp?.email || 'demo@sporthub.com',
      fullName: temp?.fullName || 'Usuario Demo',
      role: this.role,
      discipline: this.discipline,
      location: this.location,
      bio: this.bio,
      createdAt: new Date(),
    };

    let profile: AnyUserProfile;

    switch (this.role) {
      case 'athlete':
        profile = {
          ...baseProfile,
          role: 'athlete',
          level: this.athleteLevel,
          position: this.position,
          currentClub: this.currentClub,
        };
        break;
      case 'health-professional':
        profile = {
          ...baseProfile,
          role: 'health-professional',
          specialtyType: this.specialtyType,
          certifications: this.certifications.split(',').map(s => s.trim()).filter(Boolean),
          servicesOffered: this.servicesOffered.split(',').map(s => s.trim()).filter(Boolean),
          priceRange: this.priceRange,
        };
        break;
      case 'coach':
        profile = {
          ...baseProfile,
          role: 'coach',
          coachType: this.coachType,
          currentTeam: this.currentTeam,
          experience: this.experience,
          certifications: this.certifications.split(',').map(s => s.trim()).filter(Boolean),
        };
        break;
      case 'institution':
        profile = {
          ...baseProfile,
          role: 'institution',
          institutionType: this.institutionType,
          foundedYear: this.foundedYear ?? undefined,
          facilities: this.facilities.split(',').map(s => s.trim()).filter(Boolean),
        };
        break;
      case 'management':
        profile = {
          ...baseProfile,
          role: 'management',
          managementType: this.managementType,
          company: this.company,
        };
        break;
      default:
        profile = { ...baseProfile, role: 'athlete', level: 'amateur' } as AnyUserProfile;
    }

    this.authService.completeProfile(profile);
    this.router.navigate(['/feed']);
  }
}
