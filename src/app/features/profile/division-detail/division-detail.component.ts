import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import { MockClubService } from '../../../mock-data/services/mock-club.service';
import { MockUserService } from '../../../mock-data/services/mock-user.service';
import { Division, Club } from '../../../core/models/club.model';
import { AnyUserProfile } from '../../../core/models/user.model';

@Component({
  selector: 'app-division-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './division-detail.component.html',
  styleUrl: './division-detail.component.scss',
})
export class DivisionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private clubService = inject(MockClubService);
  private userService = inject(MockUserService);

  club = signal<Club | null>(null);
  division = signal<Division | null>(null);
  players = signal<AnyUserProfile[]>([]);
  staff = signal<AnyUserProfile[]>([]);

  ngOnInit(): void {
    const clubId = this.route.snapshot.paramMap.get('clubId') ?? '';
    const divisionId = this.route.snapshot.paramMap.get('divisionId') ?? '';

    this.clubService.getClubById(clubId).subscribe(club => {
      this.club.set(club ?? null);
    });

    this.clubService.getDivisionById(divisionId).subscribe(div => {
      if (div) {
        this.division.set(div);
        this.loadMembers(div);
      }
    });
  }

  private loadMembers(div: Division): void {
    // Load players
    const playerProfiles: AnyUserProfile[] = [];
    const staffProfiles: AnyUserProfile[] = [];

    div.playerIds.forEach(id => {
      this.userService.getUserById(id).subscribe(user => {
        if (user) playerProfiles.push(user);
        this.players.set([...playerProfiles]);
      });
    });

    div.staffIds.forEach(id => {
      this.userService.getUserById(id).subscribe(user => {
        if (user) staffProfiles.push(user);
        this.staff.set([...staffProfiles]);
      });
    });
  }

  getProfileRoute(user: AnyUserProfile): string[] {
    switch (user.role) {
      case 'athlete':
        return ['/profile/athlete', user.id];
      case 'health-professional':
      case 'coach':
        return ['/profile/professional', user.id];
      default:
        return ['/profile/athlete', user.id];
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'athlete': return 'directions_run';
      case 'health-professional': return 'medical_services';
      case 'coach': return 'sports';
      default: return 'person';
    }
  }
}
