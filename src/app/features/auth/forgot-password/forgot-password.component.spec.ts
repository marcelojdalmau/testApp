import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
  let router: Router;

  beforeEach(async () => {
    const isLoading = signal(false);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['forgotPassword']) as jasmine.SpyObj<AuthService> & {
      isLoading: ReturnType<typeof signal<boolean>>;
    };
    (authServiceSpy as unknown as { isLoading: ReturnType<typeof signal<boolean>> }).isLoading =
      isLoading;

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('should be invalid when email is empty', () => {
      component.form.controls.email.setValue('');
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when email format is wrong', () => {
      component.form.controls.email.setValue('not-an-email');
      expect(component.form.invalid).toBeTrue();
    });

    it('should be valid with a correct email', () => {
      component.form.controls.email.setValue('user@example.com');
      expect(component.form.valid).toBeTrue();
    });

    it('should not call forgotPassword when form is invalid', () => {
      component.form.controls.email.setValue('');
      component.submit();
      expect(authServiceSpy.forgotPassword).not.toHaveBeenCalled();
    });
  });

  describe('submission', () => {
    it('should call forgotPassword with email and navigate to reset-password with email state on success', () => {
      authServiceSpy.forgotPassword.and.returnValue(of(void 0));
      component.form.controls.email.setValue('user@example.com');

      component.submit();

      expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('user@example.com');
      expect(router.navigate).toHaveBeenCalledWith(['/auth/reset-password'], {
        state: { email: 'user@example.com' },
      });
    });

    it('should show generic info message on error and not navigate', () => {
      authServiceSpy.forgotPassword.and.returnValue(throwError(() => ({ statusCode: 404, message: 'not found' })));
      component.form.controls.email.setValue('user@example.com');

      component.submit();

      expect(component.infoMessage).toBe('Si el email existe, se envió un código de recuperación.');
      expect(router.navigate).not.toHaveBeenCalled();
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
