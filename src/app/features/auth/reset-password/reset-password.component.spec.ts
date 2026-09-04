import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
  let router: Router;

  async function setup(state: Record<string, unknown> = { email: 'user@example.com' }): Promise<void> {
    const isLoading = signal(false);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'confirmForgotPassword',
    ]) as jasmine.SpyObj<AuthService> & { isLoading: ReturnType<typeof signal<boolean>> };
    (authServiceSpy as unknown as { isLoading: ReturnType<typeof signal<boolean>> }).isLoading =
      isLoading;

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    // Component reads email from history.state in its constructor.
    history.replaceState(state, '');

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    history.replaceState({}, '');
  });

  it('should create and read email from history state', async () => {
    await setup({ email: 'someone@example.com' });
    expect(component).toBeTruthy();
    expect(component.email).toBe('someone@example.com');
  });

  describe('form validation', () => {
    beforeEach(async () => {
      await setup();
    });

    it('should be invalid when code is empty', () => {
      component.form.setValue({ code: '', new_password: 'password1', confirmPassword: 'password1' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when password is shorter than 8 characters', () => {
      component.form.setValue({ code: '123456', new_password: 'short', confirmPassword: 'short' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when confirmPassword does not match', () => {
      component.form.setValue({ code: '123456', new_password: 'password1', confirmPassword: 'different1' });
      expect(component.form.invalid).toBeTrue();
    });

    it('should be valid with code, valid password, and matching confirm', () => {
      component.form.setValue({ code: '123456', new_password: 'password1', confirmPassword: 'password1' });
      expect(component.form.valid).toBeTrue();
    });

    it('should not call confirmForgotPassword when form is invalid', () => {
      component.form.setValue({ code: '', new_password: '', confirmPassword: '' });
      component.submit();
      expect(authServiceSpy.confirmForgotPassword).not.toHaveBeenCalled();
    });
  });

  describe('submission', () => {
    beforeEach(async () => {
      await setup({ email: 'user@example.com' });
    });

    it('should call confirmForgotPassword with email, code, and new_password on submit', () => {
      authServiceSpy.confirmForgotPassword.and.returnValue(of(void 0));
      component.form.setValue({ code: '123456', new_password: 'password1', confirmPassword: 'password1' });

      component.submit();

      expect(authServiceSpy.confirmForgotPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        code: '123456',
        new_password: 'password1',
      });
    });

    it('should set success message and navigate to login on success', () => {
      authServiceSpy.confirmForgotPassword.and.returnValue(of(void 0));
      component.form.setValue({ code: '123456', new_password: 'password1', confirmPassword: 'password1' });

      component.submit();

      expect(component.successMessage).toBe('Tu contraseña se actualizó correctamente.');
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('should show invalid/expired code error on failure and not navigate', () => {
      authServiceSpy.confirmForgotPassword.and.returnValue(
        throwError(() => ({ statusCode: 400, message: 'Invalid code' })),
      );
      component.form.setValue({ code: '000000', new_password: 'password1', confirmPassword: 'password1' });

      component.submit();

      expect(component.errorMessage).toBe('El código es inválido o expiró.');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    beforeEach(async () => {
      await setup();
    });

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
