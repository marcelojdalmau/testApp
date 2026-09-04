import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import * as fc from 'fast-check';

import { professionalGuard } from './professional.guard';
import { athleteGuard } from './athlete.guard';
import { CurrentUserService } from '../services/current-user.service';
import { UserRole } from '../models/user.model';

/**
 * Property-based tests for the role-routing guards.
 * Feature: management-restructure, Property 2: Role-guard routing
 *
 * For any UserRole value (including undetermined), the professionalGuard SHALL allow
 * activation for Non_Athlete_Roles, redirect athletes to /control-center, and redirect
 * undetermined users to /feed; symmetrically the athleteGuard SHALL allow athletes,
 * redirect Non_Athlete_Roles to /management, and redirect undetermined users to /feed.
 *
 * The guards decide from the `CurrentUserService.role` signal directly.
 *
 * **Validates: Requirements 3.2, 3.3, 3.5, 3.7**
 */
describe('Feature: management-restructure, Property 2: Role-guard routing', () => {
  let currentUserSpy: { role: jasmine.Spy };
  let routerSpy: jasmine.SpyObj<Router>;

  /** Dummy route/state; the guards do not read them. */
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  /**
   * Arbitrary over every UserRole value plus the undetermined case, so the property
   * exercises the full role space the guards must classify.
   */
  const roleArb: fc.Arbitrary<UserRole | 'undetermined'> = fc.constantFrom<UserRole | 'undetermined'>(
    'athlete',
    'health-professional',
    'coach',
    'institution',
    'management',
    'undetermined',
  );

  beforeEach(() => {
    // role is a Signal; a spy function returning the generated value models it.
    currentUserSpy = { role: jasmine.createSpy('role') };

    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        { provide: CurrentUserService, useValue: currentUserSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('professionalGuard allows Non_Athlete_Roles, redirects athletes to /control-center and undetermined to /feed', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        // Arrange
        currentUserSpy.role.and.returnValue(role);
        routerSpy.navigate.calls.reset();

        // Act
        const result = TestBed.runInInjectionContext(() => professionalGuard(route, state));

        // Assert
        if (role === 'athlete') {
          expect(result).toBe(false);
          expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/control-center']);
        } else if (role === 'undetermined') {
          expect(result).toBe(false);
          expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/feed']);
        } else {
          expect(result).toBe(true);
          expect(routerSpy.navigate).not.toHaveBeenCalled();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('athleteGuard allows athletes, redirects Non_Athlete_Roles to /management and undetermined to /feed', () => {
    fc.assert(
      fc.property(roleArb, (role) => {
        // Arrange
        currentUserSpy.role.and.returnValue(role);
        routerSpy.navigate.calls.reset();

        // Act
        const result = TestBed.runInInjectionContext(() => athleteGuard(route, state));

        // Assert
        if (role === 'athlete') {
          expect(result).toBe(true);
          expect(routerSpy.navigate).not.toHaveBeenCalled();
        } else if (role === 'undetermined') {
          expect(result).toBe(false);
          expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/feed']);
        } else {
          expect(result).toBe(false);
          expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/management']);
        }
      }),
      { numRuns: 100 },
    );
  });
});
