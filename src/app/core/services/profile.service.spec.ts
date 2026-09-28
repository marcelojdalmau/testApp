import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ProfileService } from './profile.service';
import { API_BASE_URL } from '../config/api.config';
import { AuthError } from '../models/auth.model';
import { ProfileResponse } from '../models/profile.model';
import { UserProfileDto } from '../models/user-profile-dto.model';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpTesting: HttpTestingController;

  const apiBase = 'http://test-api.example.com';

  const mockProfile: UserProfileDto = {
    id: 'profile-001',
    common: {
      profilePhoto: { fileName: 'photo.png', url: 'https://cdn/photo.png' },
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      birthDate: new Date('1990-01-01'),
      identityDocumentNumber: 'X123456',
      documentTypeId: 'doc-type-1',
      idCardVerification: { fileName: 'id.png', url: 'https://cdn/id.png' },
      nationalityId: 'nat-1',
      sexId: 'sex-1',
      personTypeId: 'person-1',
    },
  };

  const mockProfileResponse: ProfileResponse = {
    profile: mockProfile,
    profile_complete: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileService,
        { provide: API_BASE_URL, useValue: apiBase },
      ],
    });

    service = TestBed.inject(ProfileService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('fetchProfile()', () => {
    it('should GET the Profile_Endpoint at /users/me (Req 4.2)', () => {
      service.fetchProfile().subscribe();

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProfileResponse);
    });

    it('should return the profile on 200 (Req 4.2)', () => {
      let response: ProfileResponse | undefined;

      service.fetchProfile().subscribe((r) => (response = r));

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      req.flush(mockProfileResponse);

      expect(response).toEqual(mockProfileResponse);
      expect(response!.profile.id).toBe('profile-001');
      expect(response!.profile_complete).toBeTrue();
    });

    it('should not attach an Authorization header itself (token is added by the interceptor)', () => {
      service.fetchProfile().subscribe();

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush(mockProfileResponse);
    });

    it('should map a 10s timeout to a connectivity AuthError (Req 4.3)', fakeAsync(() => {
      let error: AuthError | undefined;

      service.fetchProfile().subscribe({
        error: (e: AuthError) => (error = e),
      });

      // A pending request exists but the backend never responds.
      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      expect(req.request.method).toBe('GET');

      // Advance the virtual clock past the 10s connectivity cap.
      tick(10_000);

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(0);
      expect(error!.message).toBe('Unable to connect. Check your internet connection.');

      // The timeout unsubscribes from and cancels the outstanding request.
      expect(req.cancelled).toBeTrue();
    }));

    it('should NOT time out when a response arrives before 10s (Req 4.3)', fakeAsync(() => {
      let response: ProfileResponse | undefined;
      let error: AuthError | undefined;

      service.fetchProfile().subscribe({
        next: (r) => (response = r),
        error: (e: AuthError) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      tick(9_000);
      req.flush(mockProfileResponse);
      tick(2_000);

      expect(error).toBeUndefined();
      expect(response).toEqual(mockProfileResponse);
    }));

    it('should map a network error (status 0) to a connectivity AuthError (Req 4.3)', () => {
      let error: AuthError | undefined;

      service.fetchProfile().subscribe({
        error: (e: AuthError) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: '' });

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(0);
      expect(error!.message).toBe('Unable to connect. Check your internet connection.');
    });

    it('should map a backend error with a readable body to an AuthError (Req 4.4)', () => {
      let error: AuthError | undefined;

      service.fetchProfile().subscribe({
        error: (e: AuthError) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      req.flush(
        { error: 'Profile not found' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(404);
      expect(error!.message).toBe('Profile not found');
      expect(error!.error).toBe('Profile not found');
    });

    it('should map a backend 500 without a readable body to a generic AuthError (Req 4.4)', () => {
      let error: AuthError | undefined;

      service.fetchProfile().subscribe({
        error: (e: AuthError) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      req.flush({}, { status: 500, statusText: 'Server Error' });

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(500);
      expect(error!.message).toBe('An unexpected error occurred. Please try again.');
      expect(error!.error).toBeUndefined();
    });

    it('should map a 401 backend error to an AuthError carrying its status (Req 4.4)', () => {
      let error: AuthError | undefined;

      service.fetchProfile().subscribe({
        error: (e: AuthError) => (error = e),
      });

      const req = httpTesting.expectOne(`${apiBase}/users/me`);
      req.flush(
        { error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

      expect(error).toBeDefined();
      expect(error!.statusCode).toBe(401);
      expect(error!.message).toBe('Unauthorized');
    });
  });
});
