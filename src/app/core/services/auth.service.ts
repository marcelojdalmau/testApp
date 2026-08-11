import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AnyUserProfile, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'sporthub-current-user';

  /** Current user signal */
  readonly currentUser = signal<AnyUserProfile | null>(this.loadUser());

  /** Whether user is authenticated */
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /** Current user role shortcut */
  readonly userRole = computed(() => this.currentUser()?.role ?? null);

  constructor(private router: Router) {}

  /**
   * Simulate login - in real app this would call a backend
   */
  login(email: string, _password: string): boolean {
    // Check if we have a stored user with this email
    const stored = this.loadUser();
    if (stored && stored.email === email) {
      this.currentUser.set(stored);
      return true;
    }
    // For the mockup, any login is valid if there's a stored profile
    if (stored) {
      this.currentUser.set(stored);
      return true;
    }
    return false;
  }

  /**
   * Simulate registration - stores basic info and proceeds to role selection
   */
  register(email: string, fullName: string, _password: string): void {
    // Store basic info temporarily; full profile created after role selection
    const tempUser: Partial<AnyUserProfile> = {
      id: this.generateId(),
      email,
      fullName,
      createdAt: new Date(),
    };
    localStorage.setItem('sporthub-temp-registration', JSON.stringify(tempUser));
  }

  /**
   * Complete the profile after role selection and profile form
   */
  completeProfile(profile: AnyUserProfile): void {
    this.currentUser.set(profile);
    this.saveUser(profile);
    localStorage.removeItem('sporthub-temp-registration');
  }

  /**
   * Get temporary registration data (used during onboarding flow)
   */
  getTempRegistration(): Partial<AnyUserProfile> | null {
    const raw = localStorage.getItem('sporthub-temp-registration');
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Logout and clear data
   */
  logout(): void {
    this.currentUser.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
    this.router.navigate(['/auth/login']);
  }

  /**
   * Switch to a different mock user (useful for demo purposes)
   */
  switchUser(profile: AnyUserProfile): void {
    this.currentUser.set(profile);
    this.saveUser(profile);
  }

  private saveUser(user: AnyUserProfile): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
  }

  private loadUser(): AnyUserProfile | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private generateId(): string {
    return 'user_' + Math.random().toString(36).substring(2, 11);
  }
}
