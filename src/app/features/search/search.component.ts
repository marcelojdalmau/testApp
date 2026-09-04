import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { MockMarketplaceService, MarketplaceFilters } from '../../mock-data/services/mock-marketplace.service';
import { MarketplaceCard } from '../../core/models/marketplace.model';
import { SportDiscipline, UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './search.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit {
  private marketplaceService = inject(MockMarketplaceService);

  searchQuery = '';
  selectedDiscipline: SportDiscipline | '' = '';
  selectedRole: UserRole | '' = '';
  selectedLocation = '';

  cards = signal<MarketplaceCard[]>([]);
  filteredCards = signal<MarketplaceCard[]>([]);

  disciplines: { value: SportDiscipline | ''; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'football', label: 'Fútbol' },
    { value: 'basketball', label: 'Básquet' },
    { value: 'rugby', label: 'Rugby' },
    { value: 'hockey', label: 'Hockey' },
    { value: 'tennis', label: 'Tenis' },
    { value: 'swimming', label: 'Natación' },
    { value: 'running', label: 'Running' },
    { value: 'volleyball', label: 'Vóley' },
    { value: 'boxing', label: 'Boxeo' },
    { value: 'cycling', label: 'Ciclismo' },
  ];

  roles: { value: UserRole | ''; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'athlete', label: 'Deportistas' },
    { value: 'health-professional', label: 'Profesionales de salud' },
    { value: 'coach', label: 'Entrenadores' },
  ];

  ngOnInit(): void {
    this.marketplaceService.getMarketplaceCards().subscribe(cards => {
      this.cards.set(cards);
      this.filteredCards.set(cards);
    });
  }

  applyFilters(): void {
    const filters: MarketplaceFilters = {};
    if (this.searchQuery) filters.query = this.searchQuery;
    if (this.selectedDiscipline) filters.discipline = this.selectedDiscipline as SportDiscipline;
    if (this.selectedRole) filters.role = this.selectedRole as UserRole;
    if (this.selectedLocation) filters.location = this.selectedLocation;

    this.marketplaceService.searchMarketplace(filters).subscribe(results => {
      this.filteredCards.set(results);
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedDiscipline = '';
    this.selectedRole = '';
    this.selectedLocation = '';
    this.filteredCards.set(this.cards());
  }

  getProfileRoute(card: MarketplaceCard): string[] {
    switch (card.role) {
      case 'athlete': return ['/profile/athlete', card.userId];
      case 'health-professional':
      case 'coach': return ['/profile/professional', card.userId];
      default: return ['/profile/athlete', card.userId];
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
