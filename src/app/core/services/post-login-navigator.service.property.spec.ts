import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import * as fc from 'fast-check';

import { PostLoginNavigator } from './post-login-navigator.service';
import { ProfileService } from './profile.service';
import { AuthService } from './auth.service';
import {
  CompletenessResult,
  ProfileCompletenessService,
} from './profile-completeness.service';
import { ProfileResponse } from '../models/profile.model';
import { UserProfileDto } from '../models/user-profile-dto.model';

/**
 * Property-based tests for PostLoginNavigator.
 * Feature: register-reform
 *
 * Property 5: El destino posterior al login es función de la completitud y la
 * URL de retorno.
 */

describe('Feature: register-reform, Property 5: El destino posterior al login es función de la completitud y la URL de retorno', () => {
  /**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   *
   * Para todo resultado de completitud y todo estado de URL de retorno:
   * - si el perfil es `incomplete` (o `errored`), el destino es siempre
   *   `/profile/complete`, aunque exista URL de retorno (Req 6.2, 6.4);
   * - si es `complete`, el destino es la URL de retorno cuando existe
   *   (Req 6.3) y `/feed` en su ausencia (Req 6.1).
   */
  let navigator: PostLoginNavigator;
  let routerSpy: jasmine.SpyObj<Router>;
  let profileSpy: jasmine.SpyObj<ProfileService>;
  let resolverSpy: jasmine.SpyObj<ProfileCompletenessService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  /** Perfil de relleno: la propiedad no depende de su contenido porque el
   * resolver está espiado y devuelve el resultado generado directamente. */
  const stubProfile = {} as UserProfileDto;
  const stubResponse: ProfileResponse = { profile: stubProfile, profile_complete: true };

  /** Un CompletenessResult exitoso con estado arbitrario. */
  const completenessArb: fc.Arbitrary<CompletenessResult> = fc.record({
    status: fc.constantFrom<'complete' | 'incomplete'>('complete', 'incomplete'),
    errored: fc.constant(false),
  });

  /** Presencia/ausencia de URL de retorno (una ruta no vacía cuando existe). */
  const returnUrlArb: fc.Arbitrary<string | null> = fc.option(
    fc
      .webPath()
      .filter((p) => p.trim().length > 0),
    { nil: null },
  );

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));
    routerSpy.navigateByUrl.and.returnValue(Promise.resolve(true));

    profileSpy = jasmine.createSpyObj<ProfileService>('ProfileService', ['fetchProfile']);
    resolverSpy = jasmine.createSpyObj<ProfileCompletenessService>(
      'ProfileCompletenessService',
      ['resolve'],
    );
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'getReturnUrl',
      'clearReturnUrl',
    ]);

    TestBed.configureTestingModule({
      providers: [
        PostLoginNavigator,
        { provide: Router, useValue: routerSpy },
        { provide: ProfileService, useValue: profileSpy },
        { provide: ProfileCompletenessService, useValue: resolverSpy },
        { provide: AuthService, useValue: authSpy },
      ],
    });

    navigator = TestBed.inject(PostLoginNavigator);
  });

  it('navega según la completitud y la URL de retorno (≥100 iteraciones)', () => {
    fc.assert(
      fc.property(
        completenessArb,
        returnUrlArb,
        (result: CompletenessResult, returnUrl: string | null) => {
          // Arrange: reset spies for each generated example.
          routerSpy.navigate.calls.reset();
          routerSpy.navigateByUrl.calls.reset();
          authSpy.clearReturnUrl.calls.reset();

          profileSpy.fetchProfile.and.returnValue(of(stubResponse));
          resolverSpy.resolve.and.returnValue(result);
          authSpy.getReturnUrl.and.returnValue(returnUrl);

          // Act + Assert inside a fakeAsync zone to drain the observable.
          fakeAsync(() => {
            navigator.navigateAfterLogin().subscribe();
            flush();

            if (result.status === 'incomplete') {
              // Req 6.2, 6.4: incompleto → siempre /profile/complete, con prioridad
              // sobre cualquier URL de retorno.
              expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/profile/complete']);
              expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
            } else if (returnUrl) {
              // Req 6.3: completo con URL de retorno → navegar a ella.
              expect(routerSpy.navigateByUrl).toHaveBeenCalledOnceWith(returnUrl);
              expect(routerSpy.navigate).not.toHaveBeenCalled();
            } else {
              // Req 6.1: completo sin URL de retorno → /feed.
              expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/feed']);
              expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
            }
          })();
        },
      ),
      { numRuns: 100 },
    );
  });
});
