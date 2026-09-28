import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';

import { AuthError } from '../models/auth.model';
import { ProfileResponse } from '../models/profile.model';
import { UserProfileDto } from '../models/user-profile-dto.model';
import { AuthService } from './auth.service';
import { PostLoginNavigator } from './post-login-navigator.service';
import { CompletenessResult, ProfileCompletenessService } from './profile-completeness.service';
import { ProfileService } from './profile.service';

/**
 * Example / unit tests for {@link PostLoginNavigator} (register-reform, task 10.3).
 *
 * These cover the concrete destination decisions and failure handling of the
 * post-login flow with stubbed collaborators, complementing the property-based
 * test suite (task 10.2). Placed in a distinct filename to avoid any collision
 * with the property spec.
 *
 * Validates: Requirements 4.3, 4.4, 6.5
 */
describe('PostLoginNavigator (example/unit tests)', () => {
  let service: PostLoginNavigator;
  let router: jasmine.SpyObj<Router>;
  let profile: jasmine.SpyObj<ProfileService>;
  let resolver: jasmine.SpyObj<ProfileCompletenessService>;
  let auth: jasmine.SpyObj<AuthService>;

  /** Minimal profile DTO — completeness is decided by the stubbed resolver. */
  const dto: UserProfileDto = { id: 'user-1' };
  const profileResponse: ProfileResponse = { profile: dto, profile_complete: true };

  const completeResult: CompletenessResult = { status: 'complete', errored: false };
  const incompleteResult: CompletenessResult = { status: 'incomplete', errored: false };
  const erroredResult: CompletenessResult = { status: 'incomplete', errored: true };

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);
    profile = jasmine.createSpyObj<ProfileService>('ProfileService', ['fetchProfile']);
    resolver = jasmine.createSpyObj<ProfileCompletenessService>('ProfileCompletenessService', [
      'resolve',
    ]);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getReturnUrl', 'clearReturnUrl']);

    TestBed.configureTestingModule({
      providers: [
        PostLoginNavigator,
        { provide: Router, useValue: router },
        { provide: ProfileService, useValue: profile },
        { provide: ProfileCompletenessService, useValue: resolver },
        { provide: AuthService, useValue: auth },
      ],
    });

    service = TestBed.inject(PostLoginNavigator);
  });

  it('complete + returnUrl present → navigateByUrl(returnUrl) and clearReturnUrl', (done) => {
    profile.fetchProfile.and.returnValue(of(profileResponse));
    resolver.resolve.and.returnValue(completeResult);
    auth.getReturnUrl.and.returnValue('/matches/42');

    service.navigateAfterLogin().subscribe({
      next: () => {
        expect(auth.clearReturnUrl).toHaveBeenCalledTimes(1);
        expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/matches/42');
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      },
      error: done.fail,
    });
  });

  it('complete + no returnUrl → navigate([/feed]) and does not clearReturnUrl', (done) => {
    profile.fetchProfile.and.returnValue(of(profileResponse));
    resolver.resolve.and.returnValue(completeResult);
    auth.getReturnUrl.and.returnValue(null);

    service.navigateAfterLogin().subscribe({
      next: () => {
        expect(router.navigate).toHaveBeenCalledOnceWith(['/feed']);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        expect(auth.clearReturnUrl).not.toHaveBeenCalled();
        done();
      },
      error: done.fail,
    });
  });

  it('incomplete → clearReturnUrl + navigate([/profile/complete]) (priority over returnUrl)', (done) => {
    profile.fetchProfile.and.returnValue(of(profileResponse));
    resolver.resolve.and.returnValue(incompleteResult);
    // Even with a return URL present, profile completion takes precedence (Req 6.4).
    auth.getReturnUrl.and.returnValue('/matches/42');

    service.navigateAfterLogin().subscribe({
      next: () => {
        expect(auth.clearReturnUrl).toHaveBeenCalledTimes(1);
        expect(router.navigate).toHaveBeenCalledOnceWith(['/profile/complete']);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        done();
      },
      error: done.fail,
    });
  });

  it('fetch failure (AuthError) → observable errors with the AuthError, no navigation (stays on login) [Req 4.3, 4.4]', (done) => {
    const authError: AuthError = { statusCode: 0, message: 'Sin conexión' };
    profile.fetchProfile.and.returnValue(throwError(() => authError) as Observable<ProfileResponse>);

    service.navigateAfterLogin().subscribe({
      next: () => done.fail('expected an error, not navigation'),
      error: (err: AuthError) => {
        expect(err).toBe(authError);
        expect(router.navigate).not.toHaveBeenCalled();
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        expect(auth.clearReturnUrl).not.toHaveBeenCalled();
        expect(resolver.resolve).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('resolution failure (resolver errored) → navigate to /profile/complete with notice [Req 6.5]', (done) => {
    profile.fetchProfile.and.returnValue(of(profileResponse));
    resolver.resolve.and.returnValue(erroredResult);

    service.navigateAfterLogin().subscribe({
      next: () => {
        expect(router.navigate).toHaveBeenCalledOnceWith(['/profile/complete'], {
          state: { notice: 'No se pudo determinar el destino.' },
        });
        expect(router.navigateByUrl).not.toHaveBeenCalled();
        done();
      },
      error: done.fail,
    });
  });

  it('global timeout (5s) with a never-emitting fetch → treated as resolution failure → /profile/complete with notice [Req 6.5]', fakeAsync(() => {
    // fetchProfile never emits, so the internal timeout(5000) fires.
    profile.fetchProfile.and.returnValue(new Subject<ProfileResponse>().asObservable());

    let completed = false;
    service.navigateAfterLogin().subscribe({
      next: () => {
        completed = true;
      },
      error: () => fail('timeout should degrade to navigation, not error'),
    });

    // Before the timeout window, nothing has happened yet.
    expect(router.navigate).not.toHaveBeenCalled();

    tick(5_000);

    expect(completed).toBeTrue();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/profile/complete'], {
      state: { notice: 'No se pudo determinar el destino.' },
    });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    // A timeout of the global resolution pipe is NOT a fetch failure.
    expect(resolver.resolve).not.toHaveBeenCalled();
  }));
});
