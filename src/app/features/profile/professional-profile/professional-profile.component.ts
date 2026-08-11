import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';

import { MockUserService } from '../../../mock-data/services/mock-user.service';
import { AnyUserProfile, HealthProfessionalProfile, CoachProfile } from '../../../core/models/user.model';

@Component({
  selector: 'app-professional-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTabsModule,
    MatDividerModule,
  ],
  templateUrl: './professional-profile.component.html',
  styleUrl: './professional-profile.component.scss',
})
export class ProfessionalProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(MockUserService);

  professional = signal<AnyUserProfile | null>(null);
  isHealthPro = signal(false);
  isCoach = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.userService.getUserById(id).subscribe(user => {
      if (user) {
        this.professional.set(user);
        this.isHealthPro.set(user.role === 'health-professional');
        this.isCoach.set(user.role === 'coach');
      }
    });
  }

  get healthPro(): HealthProfessionalProfile | null {
    const p = this.professional();
    return p?.role === 'health-professional' ? p as HealthProfessionalProfile : null;
  }

  get coach(): CoachProfile | null {
    const p = this.professional();
    return p?.role === 'coach' ? p as CoachProfile : null;
  }

  getSpecialtyLabel(type: string): string {
    switch (type) {
      case 'nutritionist': return 'Nutricionista';
      case 'physical-trainer': return 'Preparador Físico';
      case 'kinesiologist': return 'Kinesiólogo/a';
      case 'sports-doctor': return 'Médico Deportivo';
      case 'psychologist': return 'Psicólogo/a Deportivo/a';
      default: return type;
    }
  }

  getCoachTypeLabel(type: string): string {
    switch (type) {
      case 'head-coach': return 'Director Técnico';
      case 'assistant-coach': return 'Asistente Técnico';
      case 'video-analyst': return 'Videoanalista';
      case 'goalkeeper-coach': return 'Entrenador de Arqueros';
      default: return type;
    }
  }
}
