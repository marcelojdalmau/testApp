import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';
import { AuthError, RegisterResponse } from '../../../core/models/auth.model';
import { SOCIAL_AUTH_STRATEGY, SocialAuthStrategy } from '../../../core/services/social/social-auth-strategy';
import { SocialAuthService } from '../../../core/services/social/social-auth.service';
import { SocialProvider } from '../../../core/models/social-auth.model';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal> };
  let socialAuthService: jasmine.SpyObj<SocialAuthService>;

  const isLoading = signal(false);

  const mockRegisterResponse: RegisterResponse = {
    user_id: 'user-001',
    email: 'new@example.com',
    status: 'pending_confirmation',
    message: 'Please check your email for verification.',
  };

  const validValues = {
    email: 'juan@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    account_type: '',
  };

  function fillValidForm(): void {
    component.form.setValue(validValues);
  }

  beforeEach(async () => {
    isLoading.set(false);

    const spy = jasmine.createSpyObj<AuthService>('AuthService', ['register', 'setLoading']);
    (spy as unknown as { isLoading: typeof isLoading }).isLoading = isLoading;

    // Mock SocialAuthService: spy on startSocialLogin (invoked on click) and
    // mapError (used by the component's catch handler to build the message).
    const socialSpy = jasmine.createSpyObj<SocialAuthService>('SocialAuthService', [
      'startSocialLogin',
      'mapError',
    ]);
    socialSpy.startSocialLogin.and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: spy },
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

    authService = TestBed.inject(AuthService) as typeof authService;
    socialAuthService = TestBed.inject(SocialAuthService) as jasmine.SpyObj<SocialAuthService>;
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('should be invalid when empty', () => {
      expect(component.form.invalid).toBeTrue();
    });

    it('should be valid when all required fields are filled correctly', () => {
      fillValidForm();
      expect(component.form.valid).toBeTrue();
    });

    it('should mark email invalid for a malformed email format', () => {
      component.form.controls.email.setValue('not-an-email');
      expect(component.form.controls.email.hasError('email')).toBeTrue();
    });

    it('should accept a valid email format', () => {
      component.form.controls.email.setValue('valid@example.com');
      expect(component.form.controls.email.hasError('email')).toBeFalse();
    });

    it('should reject a password shorter than 8 characters', () => {
      component.form.controls.password.setValue('short');
      expect(component.form.controls.password.hasError('password')).toBeTrue();
    });

    it('should reject a password longer than 72 characters', () => {
      component.form.controls.password.setValue('a'.repeat(73));
      expect(component.form.controls.password.hasError('password')).toBeTrue();
    });

    it('should accept a password within the 8-72 character range', () => {
      component.form.controls.password.setValue('password123');
      expect(component.form.controls.password.hasError('password')).toBeFalse();
    });

    it('should produce a matchField error when confirmPassword differs from password', () => {
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('different123');
      expect(component.form.controls.confirmPassword.hasError('matchField')).toBeTrue();
    });

    it('should clear the matchField error when confirmPassword matches password', () => {
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('password123');
      component.form.controls.confirmPassword.updateValueAndValidity();
      expect(component.form.controls.confirmPassword.hasError('matchField')).toBeFalse();
    });
  });

  describe('submit button', () => {
    function submitButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('button.register-btn');
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

  describe('register() submission', () => {
    it('should not call register when the form is invalid', () => {
      component.register();
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should call register with the mapped payload (omitting empty account_type)', () => {
      authService.register.and.returnValue(of(mockRegisterResponse));
      fillValidForm();

      component.register();

      expect(authService.register).toHaveBeenCalledWith({
        email: 'juan@example.com',
        password: 'password123',
      });
    });

    it('should include account_type in the payload when provided', () => {
      authService.register.and.returnValue(of(mockRegisterResponse));
      component.form.setValue({ ...validValues, account_type: 'coach' });

      component.register();

      expect(authService.register).toHaveBeenCalledWith(
        jasmine.objectContaining({ account_type: 'coach' }),
      );
    });

    it('should display the success message and reset the form on success (201)', () => {
      authService.register.and.returnValue(of(mockRegisterResponse));
      fillValidForm();

      component.register();
      fixture.detectChanges();

      expect(component.successMessage()).toBe(
        'Cuenta creada. Revisá tu email para verificar tu cuenta.',
      );
      expect(component.errorMessage()).toBe('');

      const successEl: HTMLElement = fixture.nativeElement.querySelector('.success-msg');
      expect(successEl?.textContent).toContain(
        'Cuenta creada. Revisá tu email para verificar tu cuenta.',
      );
    });
  });

  describe('error handling', () => {
    function submitWithError(error: AuthError): void {
      authService.register.and.returnValue(throwError(() => error));
      fillValidForm();
      component.register();
      fixture.detectChanges();
    }

    it('should display "El email ya está registrado." on 409', () => {
      submitWithError({ statusCode: 409, message: 'conflict' });
      expect(component.errorMessage()).toBe('El email ya está registrado.');
    });

    it('should display the registration-not-allowed message on 403', () => {
      submitWithError({ statusCode: 403, message: 'forbidden' });
      expect(component.errorMessage()).toBe('El registro no está permitido.');
    });

    it('should display the backend message on 400', () => {
      submitWithError({ statusCode: 400, message: 'El campo email es inválido.' });
      expect(component.errorMessage()).toBe('El campo email es inválido.');
    });

    it('should render the error message in the DOM', () => {
      submitWithError({ statusCode: 409, message: 'conflict' });
      const errorEl: HTMLElement = fixture.nativeElement.querySelector('.error-msg');
      expect(errorEl?.textContent).toContain('El email ya está registrado.');
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
        expect(text).toContain('cuenta');
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
      it('should re-enable the buttons and show a mapped Spanish message when the flow fails', fakeAsync(() => {
        // The component maps the failure via socialAuthService.mapError and
        // releases the loading state via authService.setLoading(false).
        socialAuthService.startSocialLogin.and.rejectWith({ status: 'error' });
        socialAuthService.mapError.and.returnValue({
          statusCode: 400,
          message: 'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.',
        });

        component.startSocialLogin('facebook');
        flushMicrotasks();
        fixture.detectChanges();

        expect(socialAuthService.mapError).toHaveBeenCalled();
        expect(authService.setLoading).toHaveBeenCalledWith(false);
        expect(component.errorMessage()).toBe(
          'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.',
        );

        const errorEl: HTMLElement = fixture.nativeElement.querySelector('.error-msg');
        expect(errorEl?.textContent).toContain(
          'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.',
        );
      }));

      it('should not show an error message on cancellation (mapError returns null)', fakeAsync(() => {
        // A cancellation maps to null, so no message is shown, but the loading
        // state is still released.
        socialAuthService.startSocialLogin.and.rejectWith({ status: 'cancelled' });
        socialAuthService.mapError.and.returnValue(null);

        component.startSocialLogin('apple');
        flushMicrotasks();
        fixture.detectChanges();

        expect(socialAuthService.mapError).toHaveBeenCalled();
        expect(authService.setLoading).toHaveBeenCalledWith(false);
        expect(component.errorMessage()).toBe('');
      }));
    });
  });
});
