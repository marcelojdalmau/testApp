import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';
import { TokenPair } from '../models/auth.model';

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  const mockTokens: TokenPair = {
    access_token: 'test-access-token',
    id_token: 'test-id-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('token storage', () => {
    it('should store and retrieve access token', () => {
      service.storeTokens(mockTokens);
      expect(service.getAccessToken()).toBe('test-access-token');
    });

    it('should store and retrieve refresh token', () => {
      service.storeTokens(mockTokens);
      expect(service.getRefreshToken()).toBe('test-refresh-token');
    });

    it('should store and retrieve id token', () => {
      service.storeTokens(mockTokens);
      expect(service.getIdToken()).toBe('test-id-token');
    });

    it('should return null when no tokens are stored', () => {
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(service.getIdToken()).toBeNull();
    });

    it('should clear tokens', () => {
      service.storeTokens(mockTokens);
      service.clearTokens();
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(service.getIdToken()).toBeNull();
    });

    it('should handle corrupted token data gracefully', () => {
      localStorage.setItem('sora-sport-auth-tokens', 'not-valid-json');
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(service.getIdToken()).toBeNull();
    });
  });

  describe('roles storage', () => {
    it('should store and retrieve roles', () => {
      service.storeRoles(['admin', 'coach']);
      expect(service.getRoles()).toEqual(['admin', 'coach']);
    });

    it('should return empty array when no roles stored', () => {
      expect(service.getRoles()).toEqual([]);
    });

    it('should clear roles', () => {
      service.storeRoles(['admin']);
      service.clearRoles();
      expect(service.getRoles()).toEqual([]);
    });

    it('should handle corrupted roles data gracefully', () => {
      localStorage.setItem('sora-sport-auth-roles', 'not-valid-json');
      expect(service.getRoles()).toEqual([]);
    });
  });

  describe('return URL storage', () => {
    it('should store and retrieve return URL', () => {
      service.storeReturnUrl('/dashboard/settings');
      expect(service.getReturnUrl()).toBe('/dashboard/settings');
    });

    it('should return null when no return URL stored', () => {
      expect(service.getReturnUrl()).toBeNull();
    });

    it('should clear return URL', () => {
      service.storeReturnUrl('/dashboard');
      service.clearReturnUrl();
      expect(service.getReturnUrl()).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear tokens, roles, and return URL', () => {
      service.storeTokens(mockTokens);
      service.storeRoles(['admin', 'player']);
      service.storeReturnUrl('/feed');

      service.clearAll();

      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(service.getIdToken()).toBeNull();
      expect(service.getRoles()).toEqual([]);
      expect(service.getReturnUrl()).toBeNull();
    });
  });
});
