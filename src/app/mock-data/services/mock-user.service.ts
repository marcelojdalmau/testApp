import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AnyUserProfile, AthleteProfile, HealthProfessionalProfile, CoachProfile, UserRole } from '../../core/models/user.model';
import { MOCK_ATHLETES } from '../athletes.data';
import { MOCK_HEALTH_PROFESSIONALS, MOCK_COACHES } from '../professionals.data';

@Injectable({
  providedIn: 'root'
})
export class MockUserService {

  /** Get all users */
  getAllUsers(): Observable<AnyUserProfile[]> {
    return of([...MOCK_ATHLETES, ...MOCK_HEALTH_PROFESSIONALS, ...MOCK_COACHES]);
  }

  /** Get all athletes */
  getAthletes(): Observable<AthleteProfile[]> {
    return of(MOCK_ATHLETES);
  }

  /** Get all health professionals */
  getHealthProfessionals(): Observable<HealthProfessionalProfile[]> {
    return of(MOCK_HEALTH_PROFESSIONALS);
  }

  /** Get all coaches */
  getCoaches(): Observable<CoachProfile[]> {
    return of(MOCK_COACHES);
  }

  /** Get user by ID */
  getUserById(id: string): Observable<AnyUserProfile | undefined> {
    const allUsers: AnyUserProfile[] = [...MOCK_ATHLETES, ...MOCK_HEALTH_PROFESSIONALS, ...MOCK_COACHES];
    return of(allUsers.find(u => u.id === id));
  }

  /** Get users by role */
  getUsersByRole(role: UserRole): Observable<AnyUserProfile[]> {
    const allUsers: AnyUserProfile[] = [...MOCK_ATHLETES, ...MOCK_HEALTH_PROFESSIONALS, ...MOCK_COACHES];
    return of(allUsers.filter(u => u.role === role));
  }

  /** Search users by name or discipline */
  searchUsers(query: string): Observable<AnyUserProfile[]> {
    const allUsers: AnyUserProfile[] = [...MOCK_ATHLETES, ...MOCK_HEALTH_PROFESSIONALS, ...MOCK_COACHES];
    const lowQuery = query.toLowerCase();
    return of(allUsers.filter(u =>
      u.fullName.toLowerCase().includes(lowQuery) ||
      u.discipline.toLowerCase().includes(lowQuery) ||
      u.location.toLowerCase().includes(lowQuery)
    ));
  }
}
