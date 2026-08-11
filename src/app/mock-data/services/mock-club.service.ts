import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Club, Division, StaffRecommendation } from '../../core/models/club.model';
import { MOCK_CLUBS } from '../clubs.data';
import { MOCK_RECOMMENDATIONS } from '../recommendations.data';

@Injectable({
  providedIn: 'root'
})
export class MockClubService {

  /** Get all clubs */
  getClubs(): Observable<Club[]> {
    return of(MOCK_CLUBS);
  }

  /** Get club by ID */
  getClubById(id: string): Observable<Club | undefined> {
    return of(MOCK_CLUBS.find(c => c.id === id));
  }

  /** Get divisions for a club */
  getDivisionsByClubId(clubId: string): Observable<Division[]> {
    const club = MOCK_CLUBS.find(c => c.id === clubId);
    return of(club?.divisions ?? []);
  }

  /** Get a specific division */
  getDivisionById(divisionId: string): Observable<Division | undefined> {
    for (const club of MOCK_CLUBS) {
      const division = club.divisions.find(d => d.id === divisionId);
      if (division) return of(division);
    }
    return of(undefined);
  }

  /** Get all recommendations for a player */
  getRecommendationsForPlayer(playerId: string): Observable<StaffRecommendation[]> {
    return of(MOCK_RECOMMENDATIONS.filter(r => r.playerId === playerId));
  }

  /** Get all recommendations by a staff member */
  getRecommendationsByStaff(staffId: string): Observable<StaffRecommendation[]> {
    return of(MOCK_RECOMMENDATIONS.filter(r => r.staffId === staffId));
  }

  /** Get club for a player (finds which club has this player in their divisions) */
  getClubForPlayer(playerId: string): Observable<Club | undefined> {
    const club = MOCK_CLUBS.find(c =>
      c.divisions.some(d => d.playerIds.includes(playerId))
    );
    return of(club);
  }

  /** Get division for a player */
  getDivisionsForPlayer(playerId: string): Observable<Division[]> {
    const divisions: Division[] = [];
    for (const club of MOCK_CLUBS) {
      for (const div of club.divisions) {
        if (div.playerIds.includes(playerId)) {
          divisions.push(div);
        }
      }
    }
    return of(divisions);
  }
}
