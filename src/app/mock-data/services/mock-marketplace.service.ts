import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Convocatoria, MarketplaceCard } from '../../core/models/marketplace.model';
import { SportDiscipline, UserRole } from '../../core/models/user.model';
import { MOCK_CONVOCATORIAS, MOCK_MARKETPLACE_CARDS } from '../marketplace.data';

export interface MarketplaceFilters {
  query?: string;
  discipline?: SportDiscipline;
  role?: UserRole;
  location?: string;
  maxPrice?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MockMarketplaceService {

  /** Get all marketplace cards */
  getMarketplaceCards(): Observable<MarketplaceCard[]> {
    return of(MOCK_MARKETPLACE_CARDS);
  }

  /** Search/filter marketplace cards */
  searchMarketplace(filters: MarketplaceFilters): Observable<MarketplaceCard[]> {
    let results = [...MOCK_MARKETPLACE_CARDS];

    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(card =>
        card.fullName.toLowerCase().includes(q) ||
        card.headline.toLowerCase().includes(q) ||
        card.tags.some(t => t.toLowerCase().includes(q)) ||
        card.location.toLowerCase().includes(q)
      );
    }

    if (filters.discipline) {
      results = results.filter(card => card.discipline === filters.discipline);
    }

    if (filters.role) {
      results = results.filter(card => card.role === filters.role);
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase();
      results = results.filter(card => card.location.toLowerCase().includes(loc));
    }

    return of(results);
  }

  /** Get all convocatorias */
  getConvocatorias(): Observable<Convocatoria[]> {
    return of(MOCK_CONVOCATORIAS);
  }

  /** Get open convocatorias */
  getOpenConvocatorias(): Observable<Convocatoria[]> {
    return of(MOCK_CONVOCATORIAS.filter(c => c.status === 'open'));
  }

  /** Get convocatorias by discipline */
  getConvocatoriasByDiscipline(discipline: SportDiscipline): Observable<Convocatoria[]> {
    return of(MOCK_CONVOCATORIAS.filter(c => c.discipline === discipline));
  }

  /** Get convocatoria by ID */
  getConvocatoriaById(id: string): Observable<Convocatoria | undefined> {
    return of(MOCK_CONVOCATORIAS.find(c => c.id === id));
  }
}
