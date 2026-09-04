import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CurrentUserService } from '../services/current-user.service';

/**
 * Guards the athlete Control Center (`/control-center`).
 *
 * - Athletes (role `'athlete'`) are allowed to activate the route.
 * - Non_Athlete_Roles (`'health-professional'`, `'coach'`, `'institution'`,
 *   `'management'`) are redirected to `/management`.
 * - Users whose role cannot be determined (`'undetermined'`) are redirected to the
 *   default landing route `/feed`.
 *
 * Requirements: 3.2, 3.3, 3.5, 3.7
 */
export const athleteGuard: CanActivateFn = (route, state) => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  const role = currentUser.role();

  if (role === 'athlete') {
    return true;
  }

  if (role === 'undetermined') {
    router.navigate(['/feed']);
    return false;
  }

  router.navigate(['/management']);
  return false;
};
