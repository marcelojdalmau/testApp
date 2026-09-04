import { Route } from '@angular/router';

import { routes } from './app.routes';
import { athleteGuard } from './core/guards/athlete.guard';
import { professionalGuard } from './core/guards/professional.guard';

/**
 * Example tests for the application routing configuration.
 *
 * Validates:
 * - Requirement 1.3: the marketplace route is retained.
 * - Requirement 1.5: the marketplace route has no redirect/role guard away from it.
 * - Requirement 3.1: the control-center route exists guarded by athleteGuard.
 */
describe('app routes configuration', () => {
  /** The children of the LayoutComponent shell route (empty-path route with children). */
  const shellChildren: Route[] = routes.find(r => r.path === '' && Array.isArray(r.children))?.children ?? [];

  function findChild(path: string): Route | undefined {
    return shellChildren.find(r => r.path === path);
  }

  it('retains the marketplace route (1.3)', () => {
    const marketplace = findChild('marketplace');
    expect(marketplace).toBeTruthy();
    expect(marketplace?.loadComponent).toBeDefined();
  });

  it('does not redirect away from or guard the marketplace route (1.5)', () => {
    const marketplace = findChild('marketplace');
    expect(marketplace?.redirectTo).toBeUndefined();
    expect(marketplace?.canActivate).toBeUndefined();
  });

  it('defines the control-center route guarded by athleteGuard (3.1)', () => {
    const controlCenter = findChild('control-center');
    expect(controlCenter).toBeTruthy();
    expect(controlCenter?.loadComponent).toBeDefined();
    expect(controlCenter?.canActivate).toContain(athleteGuard);
  });

  it('guards the management route with professionalGuard (3.2)', () => {
    const management = findChild('management');
    expect(management).toBeTruthy();
    expect(management?.canActivate).toContain(professionalGuard);
  });
});
