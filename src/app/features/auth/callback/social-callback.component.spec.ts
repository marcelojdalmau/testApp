import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, ParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';

import { SocialCallbackComponent } from './social-callback.component';
import { SocialAuthService } from '../../../core/services/social/social-auth.service';
import { AuthError, LoginResponse } from '../../../core/models/auth.model';

/**
 * Mensaje de UI (en español) para un error genérico del proveedor. Debe
 * coincidir con la constante `PROVIDER_ERROR_MESSAGE` del componente.
 */
const PROVIDER_ERROR_MESSAGE =
  'No se pudo completar la autenticación con el proveedor. Intentá de nuevo.';

describe('SocialCallbackComponent', () => {
  let fixture: ComponentFixture<SocialCallbackComponent>;
  let socialAuthService: jasmine.SpyObj<SocialAuthService>;
  let router: jasmine.SpyObj<Router>;

  const mockLoginResponse: LoginResponse = {
    access_token: 'access-123',
    id_token: 'id-456',
    refresh_token: 'refresh-789',
    expires_in: 3600,
    default_tenant_id: 'tenant-123',
    roles: ['player'],
  };

  /**
   * Configura el TestBed con un `ActivatedRoute` cuyo `snapshot.queryParamMap`
   * devuelve los query params indicados y un `SocialAuthService` mock cuyo
   * `handleCallback` devuelve `callbackResult`. Crea el componente, lo que
   * dispara `ngOnInit`.
   *
   * @param queryParams Los query params expuestos por el `ActivatedRoute` mock.
   * @param callbackResult El Observable que devolverá `handleCallback` cuando se
   *   invoque (por defecto, un éxito con `mockLoginResponse`).
   */
  async function setup(
    queryParams: Record<string, string>,
    callbackResult: Observable<LoginResponse> = of(mockLoginResponse),
  ): Promise<void> {
    const paramMap: ParamMap = convertToParamMap(queryParams);

    const socialSpy = jasmine.createSpyObj<SocialAuthService>(
      'SocialAuthService',
      ['handleCallback'],
    );
    socialSpy.handleCallback.and.returnValue(callbackResult);

    await TestBed.configureTestingModule({
      imports: [SocialCallbackComponent, NoopAnimationsModule],
      providers: [
        { provide: SocialAuthService, useValue: socialSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: paramMap } },
        },
      ],
    }).compileComponents();

    socialAuthService = TestBed.inject(
      SocialAuthService,
    ) as jasmine.SpyObj<SocialAuthService>;

    const realRouter = TestBed.inject(Router);
    spyOn(realRouter, 'navigate').and.resolveTo(true);
    router = realRouter as jasmine.SpyObj<Router>;

    fixture = TestBed.createComponent(SocialCallbackComponent);
    // Dispara ngOnInit.
    fixture.detectChanges();
  }

  describe('code + state válidos', () => {
    it('should invoke handleCallback with the code and state from query params', async () => {
      await setup({ code: 'auth-code-1', state: 'state-xyz' });

      expect(socialAuthService.handleCallback).toHaveBeenCalledWith(
        'auth-code-1',
        'state-xyz',
      );
      // On success the component does NOT redirect to login; navigation is
      // handled internally by handleCallback.
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should show the loading spinner while processing', async () => {
      await setup({ code: 'auth-code-1', state: 'state-xyz' });

      const spinner = fixture.nativeElement.querySelector(
        'mat-progress-spinner',
      );
      expect(spinner).toBeTruthy();
    });

    it('should redirect to login with the error message when handleCallback fails', async () => {
      const error: AuthError = {
        statusCode: 400,
        message: 'Fallo del backend',
      };
      await setup(
        { code: 'auth-code-1', state: 'state-xyz' },
        throwError(() => error),
      );

      expect(socialAuthService.handleCallback).toHaveBeenCalledWith(
        'auth-code-1',
        'state-xyz',
      );
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { error: 'Fallo del backend' },
      });
    });
  });

  describe('error del proveedor (Req 5.2)', () => {
    it('should redirect to login with error_description and NOT call handleCallback', async () => {
      await setup({
        error: 'server_error',
        error_description: 'El proveedor rechazó la solicitud',
      });

      expect(socialAuthService.handleCallback).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { error: 'El proveedor rechazó la solicitud' },
      });
    });

    it('should redirect to login with the default provider message when error has no description', async () => {
      await setup({ error: 'server_error' });

      expect(socialAuthService.handleCallback).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { error: PROVIDER_ERROR_MESSAGE },
      });
    });
  });

  describe('cancelación por la persona usuaria - access_denied (Req 5.1)', () => {
    it('should redirect to login WITHOUT an error message and NOT call handleCallback', async () => {
      await setup({ error: 'access_denied' });

      expect(socialAuthService.handleCallback).not.toHaveBeenCalled();
      // Cancellation returns to login with an empty queryParams object (no error).
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: {},
      });
    });
  });

  describe('code ausente (Req 5.2)', () => {
    it('should treat a missing code as error and redirect to login without calling handleCallback', async () => {
      await setup({ state: 'state-xyz' });

      expect(socialAuthService.handleCallback).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { error: PROVIDER_ERROR_MESSAGE },
      });
    });

    it('should treat a missing state as error and redirect to login without calling handleCallback', async () => {
      await setup({ code: 'auth-code-1' });

      expect(socialAuthService.handleCallback).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { error: PROVIDER_ERROR_MESSAGE },
      });
    });
  });
});
