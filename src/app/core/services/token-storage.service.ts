import { Injectable } from '@angular/core';
import { TokenPair } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly TOKENS_KEY = 'sora-sport-auth-tokens';
  private readonly ROLES_KEY = 'sora-sport-auth-roles';
  private readonly RETURN_URL_KEY = 'sora-sport-return-url';
  private readonly DEMO_USER_KEY = 'sora-sport-demo-user';

  storeTokens(tokens: TokenPair): void {
    localStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
  }

  getAccessToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.access_token ?? null;
  }

  getRefreshToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.refresh_token ?? null;
  }

  getIdToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.id_token ?? null;
  }

  clearTokens(): void {
    localStorage.removeItem(this.TOKENS_KEY);
  }

  storeRoles(roles: string[]): void {
    localStorage.setItem(this.ROLES_KEY, JSON.stringify(roles));
  }

  getRoles(): string[] {
    const raw = localStorage.getItem(this.ROLES_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  clearRoles(): void {
    localStorage.removeItem(this.ROLES_KEY);
  }

  storeReturnUrl(url: string): void {
    localStorage.setItem(this.RETURN_URL_KEY, url);
  }

  getReturnUrl(): string | null {
    return localStorage.getItem(this.RETURN_URL_KEY);
  }

  clearReturnUrl(): void {
    localStorage.removeItem(this.RETURN_URL_KEY);
  }

  /**
   * Persists the selected demo user profile. Used by the demo user switcher while the
   * app is mid-migration from the deprecated `AuthService.currentUser()` stub to
   * token-based identity: there is no real token in demo mode, so the chosen profile is
   * stored here and surfaced through `AuthService.currentUser()` / `CurrentUserService`.
   */
  storeDemoUser<T>(profile: T): void {
    localStorage.setItem(this.DEMO_USER_KEY, JSON.stringify(profile));
  }

  getDemoUser<T = unknown>(): T | null {
    const raw = localStorage.getItem(this.DEMO_USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  clearDemoUser(): void {
    localStorage.removeItem(this.DEMO_USER_KEY);
  }

  clearAll(): void {
    this.clearTokens();
    this.clearRoles();
    this.clearReturnUrl();
    this.clearDemoUser();
  }

  private getStoredTokens(): TokenPair | null {
    const raw = localStorage.getItem(this.TOKENS_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
