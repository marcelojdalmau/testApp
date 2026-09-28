import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { SetPasswordComponent } from './set-password.component';
import { AuthService } from '../../../core/services/auth.service';
import { PostLoginNavigator } from '../../../core/services/post-login-navigator.service';
import { AuthError, LoginResponse } from '../../../core/models/auth.model';

describe('SetPasswordComponent', () => {
  let fixture: ComponentFixture<SetPasswordComponent>;
  let component: SetPasswordComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
  let navigatorSpy: jasmine.SpyObj<PostLoginNavigator>;
  let router: Router;

  const validSession = { session: 'session-abc', email: 'user@example.com' };

  const mockLoginResponse: LoginResponse = {
    access_token: 'access-123',
    id_token: 'id-456',
    refresh_token: 'refresh-789',
    expires_in: 3600,
    default_tenant_id: 'tenant-1',
    roles: ['player'],
  };

  async function setup(state: Record<string, unknown>): Promise<void> {
    const isLoading = signal(false);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'respondToChallenge',
    ]) as jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
    (authServiceSpy as unknown as { isLoading: ReturnType<typeof signal<boolean>> }).isLoading =
      isLoading;

    navigatorSpy = jasmine.createSpyObj<PostLoginNavigator>('PostLoginNavigator', [
      'navigateAfterLogin',
    ]);
    navigatorSpy.navigateAfterLogin.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [SetPasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: PostLoginNavigator, useValue: navigatorSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

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
      it('should call respondToChallenge with session, email, and new_password', () => {
        authServiceSpy.respondToChallenge.and.returnValue(of(mockLoginResponse));
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(authServiceSpy.respondToChallenge).toHaveBeenCalledWith({
          session: 'session-abc',
          email: 'user@example.com',
          new_password: 'password1',
        });
      });

      // Req 7.1: tras completar el reto se aplica la misma resolución/enrutamiento
      // que el login sin reto, delegando en PostLoginNavigator.navigateAfterLogin().
      it('should delegate post-login routing to PostLoginNavigator on challenge success (parity with login)', () => {
        authServiceSpy.respondToChallenge.and.returnValue(of(mockLoginResponse));
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(navigatorSpy.navigateAfterLogin).toHaveBeenCalledTimes(1);
      });

      // Req 7.4: el componente no navega directamente a una ruta protegida; la
      // navegación se delega al navigator, que solo enruta tras la resolución.
      it('should not navigate to a protected route itself on challenge success', () => {
        authServiceSpy.respondToChallenge.and.returnValue(of(mockLoginResponse));
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(router.navigate).not.toHaveBeenCalledWith(['/feed']);
        expect(router.navigate).not.toHaveBeenCalledWith(['/profile/complete']);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
      });

      // Req 7.3: un fallo de obtención del perfil (AuthError) mantiene la sesión
      // activa, muestra el mensaje y el componente no navega por su cuenta.
      it('should show error and not navigate when navigateAfterLogin fails (session stays active)', () => {
        const fetchError: AuthError = { statusCode: 503, message: 'No pudimos obtener tu perfil.' };
        authServiceSpy.respondToChallenge.and.returnValue(of(mockLoginResponse));
        navigatorSpy.navigateAfterLogin.and.returnValue(throwError(() => fetchError));
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(navigatorSpy.navigateAfterLogin).toHaveBeenCalledTimes(1);
        expect(component.errorMessage).toBe('No pudimos obtener tu perfil.');
        expect(router.navigate).not.toHaveBeenCalledWith(['/feed']);
        expect(router.navigate).not.toHaveBeenCalledWith(['/profile/complete']);
        expect(router.navigateByUrl).not.toHaveBeenCalled();
      });

      it('should show fallback message when navigateAfterLogin error has no message', () => {
        authServiceSpy.respondToChallenge.and.returnValue(of(mockLoginResponse));
        navigatorSpy.navigateAfterLogin.and.returnValue(
          throwError(() => ({ statusCode: 500 }) as AuthError),
        );
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(component.errorMessage).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
      });

      it('should show backend error message on respondToChallenge failure', () => {
        authServiceSpy.respondToChallenge.and.returnValue(
          throwError(() => ({ statusCode: 400, message: 'Password does not meet policy' })),
        );
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });

        component.submit();

        expect(component.errorMessage).toBe('Password does not meet policy');
        expect(navigatorSpy.navigateAfterLogin).not.toHaveBeenCalled();
      });

      it('should show fallback message when respondToChallenge error has no message', () => {
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

      it('should enable the submit button when isLoading is false and the form is valid', () => {
        authServiceSpy.isLoading.set(false);
        component.form.setValue({ new_password: 'password1', confirmPassword: 'password1' });
        fixture.detectChanges();

        const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
        expect(button.disabled).toBeFalse();
      });
    });
  });
});
