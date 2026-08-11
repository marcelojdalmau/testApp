import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';

import { MockMarketplaceService, MarketplaceFilters } from '../../mock-data/services/mock-marketplace.service';
import { MarketplaceCard, Convocatoria } from '../../core/models/marketplace.model';
import { SportDiscipline, UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-marketplace',
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
    MatCardModule,
    MatChipsModule,
    MatTabsModule,
  ],
  templateUrl: './marketplace.component.html',
  styleUrl: './marketplace.component.scss',
})
export class MarketplaceComponent implements OnInit {
  private marketplaceService = inject(MockMarketplaceService);

  // Filters
  searchQuery = '';
  selectedDiscipline: SportDiscipline | '' = '';
  selectedRole: UserRole | '' = '';
  selectedLocation = '';

  // Results
  cards = signal<MarketplaceCard[]>([]);
  convocatorias = signal<Convocatoria[]>([]);
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
    this.marketplaceService.getOpenConvocatorias().subscribe(convs => {
      this.convocatorias.set(convs);
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
      case 'athlete':
        return ['/profile/athlete', card.userId];
      case 'health-professional':
      case 'coach':
        return ['/profile/professional', card.userId];
      default:
        return ['/profile/athlete', card.userId];
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

  getConvocatoriaIcon(type: string): string {
    switch (type) {
      case 'job': return 'work';
      case 'tryout': return 'sports_soccer';
      case 'sponsor': return 'handshake';
      case 'service': return 'medical_services';
      default: return 'work';
    }
  }

  getConvocatoriaColor(type: string): string {
    switch (type) {
      case 'job': return '#1565c0';
      case 'tryout': return '#e65100';
      case 'sponsor': return '#2e7d32';
      case 'service': return '#6a1b9a';
      default: return '#616161';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'job': return 'Empleo';
      case 'tryout': return 'Prueba';
      case 'sponsor': return 'Sponsor';
      case 'service': return 'Servicio';
      default: return type;
    }
  }
}
