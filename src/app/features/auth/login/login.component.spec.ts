import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { PostLoginNavigator } from '../../../core/services/post-login-navigator.service';
import { AuthError, LoginResponse } from '../../../core/models/auth.model';
import { SOCIAL_AUTH_STRATEGY, SocialAuthStrategy } from '../../../core/services/social/social-auth-strategy';
import { SocialAuthService } from '../../../core/services/social/social-auth.service';
import { SocialProvider } from '../../../core/models/social-auth.model';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService> & { isLoading: WritableSignal<boolean> };
  let socialAuthService: jasmine.SpyObj<SocialAuthService>;
  let navigatorSpy: jasmine.SpyObj<PostLoginNavigator>;
  let router: jasmine.SpyObj<Router>;
  let isLoading: WritableSignal<boolean>;

  const mockLoginResponse: LoginResponse = {
    access_token: 'access-123',
    id_token: 'id-456',
    refresh_token: 'refresh-789',
    expires_in: 3600,
    default_tenant_id: 'tenant-123',
    roles: ['player'],
  };

  const mockChallengeResponse: LoginResponse = {
    access_token: '',
    id_token: '',
    refresh_token: '',
    expires_in: 0,
    default_tenant_id: '',
    roles: [],
    challenge: 'NEW_PASSWORD_REQUIRED',
    session: 'session-abc',
  };

  const validCredentials = {
    email: 'user@example.com',
    password: 'password123',
  };

  beforeEach(async () => {
    isLoading = signal(false);

    const authSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'login',
      'getReturnUrl',
      'clearReturnUrl',
    ]);
    // isLoading is consumed as a signal (this.authService.isLoading -> isLoading())
    (authSpy as unknown as { isLoading: WritableSignal<boolean> }).isLoading = isLoading;

    // Mock SocialAuthService so we can assert startSocialLogin is invoked with
    // the correct provider without triggering the real PKCE/redirect flow.
    const socialSpy = jasmine.createSpyObj<SocialAuthService>('SocialAuthService', [
      'startSocialLogin',
    ]);
    socialSpy.startSocialLogin.and.resolveTo(undefined);

    // El login sin reto delega el enrutamiento posterior en PostLoginNavigator
    // (Req 4.1, 6.1-6.5). Por defecto resuelve sin error para no navegar aquí.
    const navSpy = jasmine.createSpyObj<PostLoginNavigator>('PostLoginNavigator', [
      'navigateAfterLogin',
    ]);
    navSpy.navigateAfterLogin.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: PostLoginNavigator, useValue: navSpy },
        { provide: SocialAuthService, useValue: socialSpy },
        {
          provide: SOCIAL_AUTH_STRATEGY,
          useValue: {
            authorize: () => Promise.resolve({ status: 'cancelled' }),
            getRedirectUri: () => 'http://localhost/auth/callback',
          } as SocialAuthStrategy,
        },
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService> & {
      isLoading: WritableSignal<boolean>;
    };
    socialAuthService = TestBed.inject(SocialAuthService) as jasmine.SpyObj<SocialAuthService>;
    navigatorSpy = TestBed.inject(PostLoginNavigator) as jasmine.SpyObj<PostLoginNavigator>;
    // Use the real Router (so RouterLink works) but spy on navigation methods.
    const realRouter = TestBed.inject(Router);
    spyOn(realRouter, 'navigate').and.resolveTo(true);
    spyOn(realRouter, 'navigateByUrl').and.resolveTo(true);
    router = realRouter as jasmine.SpyObj<Router>;

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillForm(values: { email: string; password: string }): void {
    component.form.setValue(values);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('should be invalid when empty', () => {
      expect(component.form.valid).toBeFalse();
      expect(component.form.controls.email.hasError('required')).toBeTrue();
      expect(component.form.controls.password.hasError('required')).toBeTrue();
    });

    it('should be valid with correct values', () => {
      fillForm(validCredentials);
      expect(component.form.valid).toBeTrue();
    });

    it('should show email validation error for an invalid email format', () => {
      fillForm({ ...validCredentials, email: 'not-an-email' });
      expect(component.form.controls.email.hasError('email')).toBeTrue();
      expect(component.form.controls.email.valid).toBeFalse();
    });

    it('should show password validation error for a short password (<8 chars)', () => {
      fillForm({ ...validCredentials, password: 'short' });
      expect(component.form.controls.password.hasError('password')).toBeTrue();
      expect(component.form.controls.password.valid).toBeFalse();
    });

    it('should not call login when the form is invalid on submit', () => {
      component.login();
      expect(authService.login).not.toHaveBeenCalled();
      expect(component.form.controls.email.touched).toBeTrue();
    });
  });

  describe('submit button state', () => {
    function submitButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    }

    it('should disable the submit button when isLoading is true', () => {
      isLoading.set(true);
      fixture.detectChanges();
      expect(submitButton().disabled).toBeTrue();
    });

    it('should enable the submit button when isLoading is false', () => {
      isLoading.set(false);
      fixture.detectChanges();
      expect(submitButton().disabled).toBeFalse();
    });
  });

  describe('login submission', () => {
    beforeEach(() => {
      fillForm(validCredentials);
    });

    it('should call authService.login with the form values', () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      component.login();

      expect(authService.login).toHaveBeenCalledWith(validCredentials);
    });

    // Req 4.1, 6.1-6.5: tras un login sin reto se delega el enrutamiento posterior
    // (fetch perfil -> resolver completitud -> navegar a /feed, returnUrl o
    // /profile/complete) en PostLoginNavigator; el componente no navega por su cuenta.
    it('should delegate post-login routing to PostLoginNavigator on success', () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      component.login();

      expect(navigatorSpy.navigateAfterLogin).toHaveBeenCalledTimes(1);
    });

    it('should not navigate to a protected route itself on non-challenge success', () => {
      authService.login.and.returnValue(of(mockLoginResponse));

      component.login();

      expect(router.navigate).not.toHaveBeenCalledWith(['/feed']);
      expect(router.navigate).not.toHaveBeenCalledWith(['/profile/complete']);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    // Req 4.3, 4.4: un fallo de obtención del perfil (AuthError) muestra el mensaje
    // y permanece en login, sin navegar.
    it('should show error and not navigate when navigateAfterLogin fails', () => {
      const fetchError: AuthError = { statusCode: 503, message: 'No pudimos obtener tu perfil.' };
      authService.login.and.returnValue(of(mockLoginResponse));
      navigatorSpy.navigateAfterLogin.and.returnValue(throwError(() => fetchError));

      component.login();

      expect(navigatorSpy.navigateAfterLogin).toHaveBeenCalledTimes(1);
      expect(component.errorMessage).toBe('No pudimos obtener tu perfil.');
      expect(router.navigate).not.toHaveBeenCalledWith(['/feed']);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('should navigate to set-password with session state on NEW_PASSWORD_REQUIRED challenge', () => {
      authService.login.and.returnValue(of(mockChallengeResponse));

      component.login();

      expect(router.navigate).toHaveBeenCalledWith(['/auth/set-password'], {
        state: { session: 'session-abc', email: validCredentials.email },
      });
    });

    it('should display "Credenciales inválidas" on a 401 error', () => {
      const error: AuthError = { statusCode: 401, message: 'Invalid credentials' };
      authService.login.and.returnValue(throwError(() => error));

      component.login();
      fixture.detectChanges();

      expect(component.errorMessage).toBe('Credenciales inválidas');
      const errorEl = fixture.nativeElement.querySelector('.error-msg') as HTMLElement;
      expect(errorEl?.textContent?.trim()).toBe('Credenciales inválidas');
    });

    it('should display "La cuenta no está activa" on a 403 error', () => {
      const error: AuthError = { statusCode: 403, message: 'Account is not active' };
      authService.login.and.returnValue(throwError(() => error));

      component.login();
      fixture.detectChanges();

      expect(component.errorMessage).toBe('La cuenta no está activa');
      const errorEl = fixture.nativeElement.querySelector('.error-msg') as HTMLElement;
      expect(errorEl?.textContent?.trim()).toBe('La cuenta no está activa');
    });

    it('should display a generic message for other errors', () => {
      const error: AuthError = { statusCode: 500, message: '' };
      authService.login.and.returnValue(throwError(() => error));

      component.login();

      expect(component.errorMessage).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
    });
  });

  describe('social authentication UI', () => {
    function socialButtons(): HTMLButtonElement[] {
      return Array.from(
        fixture.nativeElement.querySelectorAll('.social-auth .social-btn'),
      ) as HTMLButtonElement[];
    }

    function socialButtonFor(provider: SocialProvider): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        `.social-auth .social-btn--${provider}`,
      ) as HTMLButtonElement;
    }

    it('should render the three provider buttons (Google, Facebook, Apple)', () => {
      const buttons = socialButtons();
      expect(buttons.length).toBe(3);

      const labels = buttons.map((btn) =>
        (btn.querySelector('.social-btn__label')?.textContent ?? '').trim(),
      );
      expect(labels).toEqual(['Google', 'Facebook', 'Apple']);
    });

    it('should always present Apple alongside Google and Facebook (iOS Guideline 4.8)', () => {
      // The three providers render unconditionally, so Apple is present whenever
      // Google/Facebook are present — satisfying Guideline 4.8 on iOS.
      expect(socialButtonFor('google')).toBeTruthy();
      expect(socialButtonFor('facebook')).toBeTruthy();
      expect(socialButtonFor('apple')).toBeTruthy();
    });

    it('should not render an institution/tenant selector in the social section', () => {
      const socialSection = fixture.nativeElement.querySelector('.social-auth') as HTMLElement;
      expect(socialSection).toBeTruthy();

      expect(socialSection.querySelector('select')).toBeNull();
      expect(socialSection.querySelector('mat-select')).toBeNull();
      expect(socialSection.querySelector('[formControlName="tenant"]')).toBeNull();
      expect(socialSection.querySelector('[formControlName="institution"]')).toBeNull();
      expect(socialSection.textContent ?? '').not.toContain('Institución');
      expect(socialSection.textContent ?? '').not.toContain('Institucion');
    });

    describe('consent control', () => {
      function consentToggle(): HTMLButtonElement {
        return fixture.nativeElement.querySelector('.consent-toggle') as HTMLButtonElement;
      }

      it('should render the "¿Qué datos solicitamos?" control', () => {
        expect(consentToggle()).toBeTruthy();
        expect(consentToggle().textContent).toContain('¿Qué datos solicitamos?');
      });

      it('should keep the consent panel collapsed initially', () => {
        expect(component.showConsent()).toBeFalse();
        expect(fixture.nativeElement.querySelector('#consent-panel')).toBeNull();
      });

      it('should reveal email and name with their purpose when expanded', () => {
        consentToggle().click();
        fixture.detectChanges();

        expect(component.showConsent()).toBeTrue();
        const panel = fixture.nativeElement.querySelector('#consent-panel') as HTMLElement;
        expect(panel).toBeTruthy();
        const text = panel.textContent ?? '';
        expect(text).toContain('Correo electrónico');
        expect(text).toContain('Nombre');
        // Purpose statements accompany each requested datum.
        expect(text).toContain('iniciar sesión');
        expect(text).toContain('perfil');
      });
    });

    describe('provider button clicks', () => {
      it('should call startSocialLogin with "google" when the Google button is clicked', () => {
        socialButtonFor('google').click();
        expect(socialAuthService.startSocialLogin).toHaveBeenCalledWith('google');
      });

      it('should call startSocialLogin with "facebook" when the Facebook button is clicked', () => {
        socialButtonFor('facebook').click();
        expect(socialAuthService.startSocialLogin).toHaveBeenCalledWith('facebook');
      });

      it('should call startSocialLogin with "apple" when the Apple button is clicked', () => {
        socialButtonFor('apple').click();
        expect(socialAuthService.startSocialLogin).toHaveBeenCalledWith('apple');
      });
    });

    describe('loading state', () => {
      it('should disable all three provider buttons while isLoading is true', () => {
        isLoading.set(true);
        fixture.detectChanges();

        const buttons = socialButtons();
        expect(buttons.length).toBe(3);
        expect(buttons.every((btn) => btn.disabled)).toBeTrue();
      });

      it('should enable all three provider buttons while isLoading is false', () => {
        isLoading.set(false);
        fixture.detectChanges();

        const buttons = socialButtons();
        expect(buttons.every((btn) => !btn.disabled)).toBeTrue();
      });
    });

    describe('error rehabilitation', () => {
      it('should re-enable the buttons and show a Spanish message when starting the flow fails', fakeAsync(() => {
        // A start failure rejects the promise; the component maps it to a
        // Spanish message and the buttons remain enabled (isLoading stays false).
        socialAuthService.startSocialLogin.and.rejectWith(new Error('boom'));

        // Click through the DOM so the OnPush view is marked for check when the
        // rejected promise's catch handler updates errorMessage.
        socialButtonFor('google').click();
        // Drain the rejected promise's catch handler, then render.
        flushMicrotasks();
        fixture.detectChanges();

        expect(component.errorMessage).toBe(
          'No se pudo iniciar la autenticación. Intentá de nuevo.',
        );

        // isLoading is not toggled true by the mock, so buttons stay enabled.
        const buttons = socialButtons();
        expect(buttons.every((btn) => !btn.disabled)).toBeTrue();

        // The message is rendered in the DOM.
        const errorEl = fixture.nativeElement.querySelector('.error-msg') as HTMLElement;
        expect(errorEl?.textContent ?? '').toContain(
          'No se pudo iniciar la autenticación. Intentá de nuevo.',
        );
      }));
    });
  });
});
