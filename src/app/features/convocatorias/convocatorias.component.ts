import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { MockMarketplaceService } from '../../mock-data/services/mock-marketplace.service';
import { Convocatoria } from '../../core/models/marketplace.model';

/** Maximum accepted length for the search query (Requirement 2.1). */
const SEARCH_QUERY_MAX_LENGTH = 100;

/** Debounce window for search input, well within the 1s bound (Requirement 2.7). */
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'app-convocatorias',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './convocatorias.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './convocatorias.component.scss',
})
export class ConvocatoriasComponent implements OnInit {
  private marketplaceService = inject(MockMarketplaceService);

  /** Maximum accepted length for the search query input (0-100 chars). */
  readonly searchMaxLength = SEARCH_QUERY_MAX_LENGTH;

  /** Full list of open convocatorias as loaded from the store. */
  allConvocatorias = signal<Convocatoria[]>([]);

  /** Current search query text (raw, untrimmed). */
  searchQuery = signal<string>('');

  /**
   * Open convocatorias filtered by the trimmed, case-insensitive query
   * against publisherName OR location. An empty trimmed query returns the
   * full list.
   */
  filteredConvocatorias = computed<Convocatoria[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const all = this.allConvocatorias();

    if (query.length === 0) {
      return all;
    }

    return all.filter(
      conv =>
        conv.publisherName.toLowerCase().includes(query) ||
        conv.location.toLowerCase().includes(query),
    );
  });

  /**
   * True when a query is present (trimmed non-empty) but no convocatoria
   * matches it. Used to show the empty-result indicator (Requirement 2.8).
   */
  noMatches = computed<boolean>(
    () => this.searchQuery().trim().length > 0 && this.filteredConvocatorias().length === 0,
  );

  private searchInput$ = new Subject<string>();

  constructor() {
    this.searchInput$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe(value => this.searchQuery.set(value));
  }

  ngOnInit(): void {
    this.marketplaceService.getOpenConvocatorias().subscribe(convs => {
      this.allConvocatorias.set(convs);
    });
  }

  /**
   * Handle raw input events from the search box. Debounces before pushing the
   * value into the searchQuery signal so filtering updates within the required
   * window.
   */
  onSearchInput(value: string): void {
    this.searchInput$.next(value.slice(0, SEARCH_QUERY_MAX_LENGTH));
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
