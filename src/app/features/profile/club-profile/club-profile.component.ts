import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';

import { MockClubService } from '../../../mock-data/services/mock-club.service';
import { Club } from '../../../core/models/club.model';

@Component({
  selector: 'app-club-profile',
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
    MatListModule,
  ],
  templateUrl: './club-profile.component.html',
  styleUrl: './club-profile.component.scss',
})
export class ClubProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private clubService = inject(MockClubService);

  club = signal<Club | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.clubService.getClubById(id).subscribe(club => {
      this.club.set(club ?? null);
    });
  }

  getDisciplineLabel(discipline: string): string {
    const labels: Record<string, string> = {
      football: 'Fútbol',
      basketball: 'Básquet',
      rugby: 'Rugby',
      hockey: 'Hockey',
      tennis: 'Tenis',
      swimming: 'Natación',
      running: 'Running',
      volleyball: 'Vóley',
      boxing: 'Boxeo',
      cycling: 'Ciclismo',
    };
    return labels[discipline] ?? discipline;
  }
}
