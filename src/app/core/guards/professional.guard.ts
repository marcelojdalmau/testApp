import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CurrentUserService } from '../services/current-user.service';

/**
 * Guards the professional workspace (`/management`).
 *
 * - Non_Athlete_Roles (`'health-professional'`, `'coach'`, `'institution'`,
 *   `'management'`) are allowed to activate the route.
 * - Athletes (role `'athlete'`) are redirected to `/control-center`.
 * - Users whose role cannot be determined (`'undetermined'`) are redirected to the
 *   default landing route `/feed`.
 *
 * Requirements: 3.2, 3.3, 3.5, 3.7
 */
export const professionalGuard: CanActivateFn = (route, state) => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  const role = currentUser.role();

  if (role === 'athlete') {
    router.navigate(['/control-center']);
    return false;
  }

  if (role === 'undetermined') {
    router.navigate(['/feed']);
    return false;
  }

  return true;
};
