import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { CompleteProfileComponent } from './complete-profile/complete-profile.component';
import { AuthService } from '../../core/services/auth.service';

/**
 * Prueba de integración de enrutamiento para la ruta `/profile/complete`.
 *
 * Validates: Requirement 6.2 — con una sesión válida (authGuard permite el acceso),
 * `/profile/complete` es alcanzable y activa `CompleteProfileComponent` bajo el shell
 * protegido definido en `app.routes.ts`. El árbol de rutas real (grupo `''` con
 * `authGuard` → hijo lazy `profile` → `complete`) se ejercita con `provideRouter`.
 */
describe('profile routing integration (/profile/complete)', () => {
  let storeReturnUrlSpy: jasmine.Spy;

  beforeEach(() => {
    storeReturnUrlSpy = jasmine.createSpy('storeReturnUrl');

    // Doble de `AuthService` que representa una sesión válida: la señal
    // `isAuthenticated` resuelve a `true`, de modo que `authGuard` (que llama a
    // `authService.isAuthenticated()`) concede el acceso al shell protegido.
    // Se cubren además los miembros que el shell (`LayoutComponent` →
    // `CurrentUserService`) lee al renderizar: `userRoles` y `currentUser`.
    const authServiceStub: Partial<AuthService> = {
      isAuthenticated: signal(true).asReadonly(),
      userRoles: signal<string[]>([]).asReadonly(),
      currentUser: () => null,
      storeReturnUrl: storeReturnUrlSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceStub },
      ],
    });
  });

  it('permite la navegación exitosa a /profile/complete con sesión válida (6.2)', async () => {
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);

    const navigated = await router.navigateByUrl('/profile/complete');

    expect(navigated).toBeTrue();
    expect(location.path()).toBe('/profile/complete');
    // Con sesión válida el guard no debe almacenar returnUrl ni redirigir a login.
    expect(storeReturnUrlSpy).not.toHaveBeenCalled();
  });

  it('activa CompleteProfileComponent en la hoja de la ruta /profile/complete (6.2)', async () => {
    const harness = await RouterTestingHarness.create();

    // El componente raíz activado es el shell (`LayoutComponent`); el componente de la
    // hoja se resuelve recorriendo `firstChild` del snapshot de la ruta activada.
    await harness.navigateByUrl('/profile/complete');

    const router = TestBed.inject(Router);
    let route: ActivatedRoute | null = router.routerState.root;
    while (route?.firstChild) {
      route = route.firstChild;
    }

    expect(route?.component).toBe(CompleteProfileComponent);
    expect(storeReturnUrlSpy).not.toHaveBeenCalled();
  });
});
