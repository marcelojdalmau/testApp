import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../core/services/auth.service';
import { MockClubService } from '../../mock-data/services/mock-club.service';
import { MockUserService } from '../../mock-data/services/mock-user.service';
import { UserRole, AnyUserProfile } from '../../core/models/user.model';
import { StaffRecommendation, Club, Division } from '../../core/models/club.model';
import { MOCK_ATHLETES } from '../../mock-data/athletes.data';

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTabsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatTooltipModule,
  ],
  templateUrl: './management.component.html',
  styleUrl: './management.component.scss',
})
export class ManagementComponent implements OnInit {
  private authService = inject(AuthService);
  private clubService = inject(MockClubService);
  private userService = inject(MockUserService);

  userRole = signal<UserRole>('athlete');
  userId = signal<string>('');
  recommendations = signal<StaffRecommendation[]>([]);
  myRecommendations = signal<StaffRecommendation[]>([]);
  clubs = signal<Club[]>([]);
  managedPlayers = signal<AnyUserProfile[]>([]);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    const role = user?.role ?? 'athlete';
    this.userRole.set(role);
    this.userId.set(user?.id ?? '');

    if (role === 'athlete') {
      // Athlete: load ALL recommendations for this athlete (from all professionals)
      const playerId = user?.id ?? MOCK_ATHLETES[0].id;
      this.clubService.getRecommendationsForPlayer(playerId).subscribe(recs => {
        this.recommendations.set(recs);
      });
    } else if (role === 'institution') {
      // Institution: load clubs
      this.clubService.getClubs().subscribe(clubs => {
        this.clubs.set(clubs);
      });
    } else if (role === 'health-professional' || role === 'coach') {
      // Professional/Coach: load ONLY recommendations created by this user
      const staffId = user?.id ?? '';
      this.clubService.getRecommendationsByStaff(staffId).subscribe(recs => {
        this.myRecommendations.set(recs);
      });
      // Also load the athletes they work with (based on their recommendations)
      this.userService.getAthletes().subscribe(athletes => {
        // Filter to athletes that have recommendations from this staff
        this.clubService.getRecommendationsByStaff(staffId).subscribe(recs => {
          const playerIds = [...new Set(recs.map(r => r.playerId))];
          const managed = athletes.filter(a => playerIds.includes(a.id));
          this.managedPlayers.set(managed.length > 0 ? managed : athletes.slice(0, 3));
        });
      });
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

  getTypeLabel(type: string): string {
    switch (type) {
      case 'diet': return 'Nutrición';
      case 'exercise': return 'Preparación Física';
      case 'rehabilitation': return 'Rehabilitación';
      case 'psychological': return 'Psicología';
      case 'tactical': return 'Táctica';
      default: return type;
    }
  }

  getRecsOfType(type: string): StaffRecommendation[] {
    return this.recommendations().filter(r => r.type === type);
  }

  /** Get recommendations created by the current professional, grouped per player */
  getMyRecsForPlayer(playerId: string): StaffRecommendation[] {
    return this.myRecommendations().filter(r => r.playerId === playerId);
  }

  /** Get player name from managed players list */
  getPlayerName(playerId: string): string {
    const player = this.managedPlayers().find(p => p.id === playerId);
    return player?.fullName ?? playerId;
  }
}
