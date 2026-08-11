import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';

import { MockUserService } from '../../../mock-data/services/mock-user.service';
import { MockClubService } from '../../../mock-data/services/mock-club.service';
import { AthleteProfile } from '../../../core/models/user.model';
import { Club, StaffRecommendation } from '../../../core/models/club.model';

@Component({
  selector: 'app-athlete-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTabsModule,
    MatDividerModule,
  ],
  templateUrl: './athlete-profile.component.html',
  styleUrl: './athlete-profile.component.scss',
})
export class AthleteProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(MockUserService);
  private clubService = inject(MockClubService);

  athlete = signal<AthleteProfile | null>(null);
  club = signal<Club | null>(null);
  recommendations = signal<StaffRecommendation[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.userService.getUserById(id).subscribe(user => {
      if (user && user.role === 'athlete') {
        this.athlete.set(user as AthleteProfile);
        this.loadClubAndRecommendations(id);
      }
    });
  }

  private loadClubAndRecommendations(playerId: string): void {
    this.clubService.getClubForPlayer(playerId).subscribe(club => {
      this.club.set(club ?? null);
    });
    this.clubService.getRecommendationsForPlayer(playerId).subscribe(recs => {
      this.recommendations.set(recs);
    });
  }

  getLevelLabel(level: string): string {
    switch (level) {
      case 'amateur': return 'Amateur';
      case 'semi-professional': return 'Semi-profesional';
      case 'professional': return 'Profesional';
      default: return level;
    }
  }

  getRecommendationIcon(type: string): string {
    switch (type) {
      case 'diet': return 'restaurant';
      case 'exercise': return 'fitness_center';
      case 'rehabilitation': return 'healing';
      case 'psychological': return 'psychology';
      case 'tactical': return 'sports_soccer';
      default: return 'assignment';
    }
  }

  getRecommendationColor(type: string): string {
    switch (type) {
      case 'diet': return '#2e7d32';
      case 'exercise': return '#1565c0';
      case 'rehabilitation': return '#e65100';
      case 'psychological': return '#6a1b9a';
      case 'tactical': return '#00838f';
      default: return '#616161';
    }
  }
}
