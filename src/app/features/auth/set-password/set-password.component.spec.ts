import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { SetPasswordComponent } from './set-password.component';
import { AuthService } from '../../../core/services/auth.service';
import { LoginResponse } from '../../../core/models/auth.model';

describe('SetPasswordComponent', () => {
  let fixture: ComponentFixture<SetPasswordComponent>;
  let component: SetPasswordComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
  let router: Router;

  const validSession = { session: 'session-abc', email: 'user@example.com' };

  const mockLoginResponse: LoginResponse = {
    access_token: 'access-123',
    id_token: 'id-456',
    refresh_token: 'refresh-789',
    expires_in: 3600,
    roles: ['player'],
  };

  async function setup(state: Record<string, unknown>): Promise<void> {
    const isLoading = signal(false);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'respondToChallenge',
    ]) as jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
    (authServiceSpy as unknown as { isLoading: ReturnType<typeof signal<boolean>> }).isLoading =
      isLoading;

    await TestBed.configureTestingModule({
      imports: [SetPasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    // Component reads session + email from history.state in its constructor.
    history.replaceState(state, '');

    fixture = TestBed.createComponent(SetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    history.replaceState({}, '');
  });

  describe('missing session context', () => {
    it('should redirect to login when session and email are absent', async () => {
      await setup({});
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('should redirect to login when only email is present', async () => {
      await setup({ email: 'user@example.com' });
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('should not call respondToChallenge on submit without session context', async () => {
      await setup({});
      (router.navigate as jasmine.Spy).calls.reset();

      component.submit();

      expect(authServiceSpy.respondToChallenge).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('with valid session context', () => {
    beforeEach(async () => {
      await setup(validSession);
    });

    it('should create without redirecting to login', () => {
      expect(component).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    });

    describe('form validation', () => {
      it('should be invalid when password is shorter than 8 characters', () => {
        component.form.setValue({ new_password: 'short', confirmPassword: 'short' });
        expect(component.form.invalid).toBeTrue();
      });

      it('should be invalid when confirmPassword does not match', () => {
        component.form.setValue({ new_password: 'password1', confirmPassword: 'different1' });
        expect(component.form.invalid).toBeTrue();
      });

      it('should be valid with valid matching passwords', () => {
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });
        expect(component.form.valid).toBeTrue();
      });

      it('should not call respondToChallenge when form is invalid', () => {
        component.form.setValue({ new_password: 'short', confirmPassword: 'short' });
        component.submit();
        expect(authServiceSpy.respondToChallenge).not.toHaveBeenCalled();
      });
    });

    describe('submission', () => {
      it('should call respondToChallenge with session, email, and new_password and navigate to feed on success', () => {
        authServiceSpy.respondToChallenge.and.returnValue(of(mockLoginResponse));
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(authServiceSpy.respondToChallenge).toHaveBeenCalledWith({
          session: 'session-abc',
          email: 'user@example.com',
          new_password: 'password1',
        });
        expect(router.navigate).toHaveBeenCalledWith(['/feed']);
      });

      it('should show backend error message on failure', () => {
        authServiceSpy.respondToChallenge.and.returnValue(
          throwError(() => ({ statusCode: 400, message: 'Password does not meet policy' })),
        );
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(component.errorMessage).toBe('Password does not meet policy');
      });

      it('should show fallback message when error has no message', () => {
        authServiceSpy.respondToChallenge.and.returnValue(throwError(() => ({ statusCode: 500 })));
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(component.errorMessage).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
      });
    });

    describe('loading state', () => {
      it('should disable the submit button when isLoading is true', () => {
        authServiceSpy.isLoading.set(true);
        fixture.detectChanges();

        const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
        expect(button.disabled).toBeTrue();
      });

      it('should enable the submit button when isLoading is false', () => {
        authServiceSpy.isLoading.set(false);
        fixture.detectChanges();

        const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
        expect(button.disabled).toBeFalse();
      });
    });
  });
});
