import { Injectable, Signal, computed, inject } from '@angular/core';

import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { UserRole } from '../models/user.model';
import { MOCK_ATHLETES } from '../../mock-data/athletes.data';

/** All UserRole values recognized by this feature, used to resolve the token role signal. */
const RECOGNIZED_ROLES: readonly UserRole[] = [
  'athlete',
  'health-professional',
  'coach',
  'institution',
  'management',
];

/**
 * Single, testable source of truth for the current user's identity and role.
 *
 * Role/identity resolution in the app is mid-migration: `AuthService.currentUser()`
 * is a deprecated stub that returns `null`, and the live source of role data is the
 * `AuthService.userRoles()` signal (populated from the auth token). This service
 * encapsulates that in-progress migration so guards and feature components depend on
 * one place instead of coupling to the transient `currentUser()` fallback pattern
 * scattered across existing components (which fall back to `MOCK_ATHLETES[0]`).
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);

  /**
   * The resolved role of the signed-in user.
   *
   * Resolves from `AuthService.userRoles()`: the first entry that matches a known
   * `UserRole` wins. When no entry is recognized (empty or unknown roles), the role
   * is `'undetermined'` and callers should route the user to the default landing page.
   */
  readonly role: Signal<UserRole | 'undetermined'> = computed(() => {
    const roles = this.authService.userRoles();
    const recognized = roles.find((role): role is UserRole =>
      (RECOGNIZED_ROLES as readonly string[]).includes(role),
    );
    return recognized ?? 'undetermined';
  });

  /**
   * The identity of the signed-in user.
   *
   * Documented fallback strategy (mirrors the migration state of `AuthService`):
   * 1. Use the id of the selected demo user profile when the demo switcher set one.
   * 2. Otherwise derive the user id from the `sub` claim of the id token when available.
   * 3. Otherwise fall back to `MOCK_ATHLETES[0].id`, matching the fallback other
   *    feature components (`ManagementComponent`, `FeedComponent`, ...) use while the
   *    `currentUser()` -> token-roles migration is in progress.
   */
  readonly userId: Signal<string> = computed(() => {
    const demoUser = this.authService.currentUser() as { id?: string } | null;
    if (demoUser?.id) {
      return demoUser.id;
    }

    const idFromToken = this.readSubjectFromIdToken();
    return idFromToken ?? MOCK_ATHLETES[0].id;
  });

  /**
   * Extracts the `sub` (subject) claim from the JWT id token, or `null` when the token
   * is absent or cannot be parsed. Kept private and defensive: any malformed token
   * yields `null` so the documented fallback applies.
   */
  private readSubjectFromIdToken(): string | null {
    const idToken = this.tokenStorage.getIdToken();
    if (!idToken) {
      return null;
    }

    const segments = idToken.split('.');
    if (segments.length < 2) {
      return null;
    }

    try {
      const payload = JSON.parse(this.decodeBase64Url(segments[1])) as { sub?: unknown };
      return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
    } catch {
      return null;
    }
  }

  /** Decodes a base64url-encoded JWT segment into its UTF-8 string payload. */
  private decodeBase64Url(segment: string): string {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return atob(padded);
  }
}
