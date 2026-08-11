import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/**
 * Interface for future per-user color customization.
 * Currently unused but prepares the architecture for profile-based theming.
 */
export interface ThemePalette {
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'sporthub-theme-mode';

  /** Current theme mode signal */
  readonly mode = signal<ThemeMode>(this.loadSavedTheme());

  /** Whether dark mode is active */
  readonly isDark = () => this.mode() === 'dark';

  constructor() {
    // React to theme changes and apply to DOM
    effect(() => {
      this.applyTheme(this.mode());
    });
  }

  /** Toggle between light and dark mode */
  toggle(): void {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  /** Set a specific theme mode */
  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /**
   * Future: Apply a custom palette from user profile.
   * This will override CSS custom properties at runtime.
   */
  applyCustomPalette(palette: ThemePalette): void {
    const root = document.documentElement;
    root.style.setProperty('--sh-primary', palette.primary);
    root.style.setProperty('--sh-primary-light', palette.primaryLight);
    root.style.setProperty('--sh-accent', palette.accent);
    root.style.setProperty('--sh-accent-light', palette.accentLight);
  }

  /** Reset to default palette (remove custom overrides) */
  resetPalette(): void {
    const root = document.documentElement;
    root.style.removeProperty('--sh-primary');
    root.style.removeProperty('--sh-primary-light');
    root.style.removeProperty('--sh-accent');
    root.style.removeProperty('--sh-accent-light');
  }

  private applyTheme(mode: ThemeMode): void {
    const htmlElement = document.documentElement;

    if (mode === 'dark') {
      htmlElement.classList.add('dark-theme');
    } else {
      htmlElement.classList.remove('dark-theme');
    }

    // Persist preference
    localStorage.setItem(this.STORAGE_KEY, mode);
  }

  private loadSavedTheme(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'light';
    }

    const saved = localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;

    if (saved) {
      return saved;
    }

    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }
}
