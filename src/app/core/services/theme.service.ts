import { Injectable, signal, effect, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/**
 * Available sport-themed skins.
 * - 'retro': Estilo años 80s/90s de gimnasio clásico, DTs old-school
 * - 'modern': Estilo actual fitness/deporte contemporáneo
 * - 'futuristic': Estilo futurista, neon, high-tech deportivo
 * - 'dark-analytics': Dashboard oscuro de análisis deportivo / DT moderno
 * - 'coral-training': Entrenador personal premium, fitness boutique coral
 * - 'classic-gym': Gimnasio elegante minimalista, editorial deportivo
 * - 'sports-club': Portal de club deportivo, fixtures, noticias
 * - 'neon-warrior': Crossfit / guerrero urbano, neones sobre negro intenso
 */
export type ThemeSkin = 'retro' | 'modern' | 'futuristic' | 'dark-analytics' | 'coral-training' | 'classic-gym' | 'sports-club' | 'neon-warrior';

export interface SkinInfo {
  id: ThemeSkin;
  label: string;
  description: string;
  icon: string;
}

/**
 * Interface for future per-user color customization.
 */
export interface ThemePalette {
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
}

/** Available skins catalog */
export const AVAILABLE_SKINS: SkinInfo[] = [
  {
    id: 'retro',
    label: 'Retro Gym',
    description: 'Estilo clásico años 80s, gimnasio old-school',
    icon: 'fitness_center',
  },
  {
    id: 'modern',
    label: 'Sport Pro',
    description: 'Estilo actual, profesional y limpio',
    icon: 'sports',
  },
  {
    id: 'futuristic',
    label: 'Cyber Athlete',
    description: 'Estilo futurista, neon y alta tecnología',
    icon: 'rocket_launch',
  },
  {
    id: 'dark-analytics',
    label: 'Dark Analytics',
    description: 'Dashboard oscuro, datos y análisis deportivo',
    icon: 'analytics',
  },
  {
    id: 'coral-training',
    label: 'Coral Training',
    description: 'Fitness boutique, entrenador personal premium',
    icon: 'self_improvement',
  },
  {
    id: 'classic-gym',
    label: 'Classic Gym',
    description: 'Minimalista elegante, editorial deportivo',
    icon: 'sports_gymnastics',
  },
  {
    id: 'sports-club',
    label: 'Sports Club',
    description: 'Portal de club deportivo, fixtures y noticias',
    icon: 'sports_soccer',
  },
  {
    id: 'neon-warrior',
    label: 'Neon Warrior',
    description: 'Crossfit / guerrero urbano, neones intensos',
    icon: 'local_fire_department',
  },
];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly MODE_STORAGE_KEY = 'sporthub-theme-mode';
  private readonly SKIN_STORAGE_KEY = 'sporthub-theme-skin';

  /** Current theme mode signal */
  readonly mode = signal<ThemeMode>(this.loadSavedTheme());

  /** Current skin signal */
  readonly skin = signal<ThemeSkin>(this.loadSavedSkin());

  /** Whether dark mode is active */
  readonly isDark = computed(() => this.mode() === 'dark');

  /** Available skins list */
  readonly skins = AVAILABLE_SKINS;

  /** Current skin info */
  readonly currentSkinInfo = computed(() =>
    AVAILABLE_SKINS.find(s => s.id === this.skin()) ?? AVAILABLE_SKINS[1]
  );

  constructor() {
    // React to theme mode changes and apply to DOM
    effect(() => {
      this.applyThemeMode(this.mode());
    });

    // React to skin changes and apply to DOM
    effect(() => {
      this.applySkin(this.skin());
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

  /** Set a specific skin */
  setSkin(skin: ThemeSkin): void {
    this.skin.set(skin);
  }

  /**
   * Apply a custom palette from user profile.
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

  private applyThemeMode(mode: ThemeMode): void {
    const htmlElement = document.documentElement;

    if (mode === 'dark') {
      htmlElement.classList.add('dark-theme');
    } else {
      htmlElement.classList.remove('dark-theme');
    }

    // Persist preference
    localStorage.setItem(this.MODE_STORAGE_KEY, mode);
  }

  private applySkin(skin: ThemeSkin): void {
    const htmlElement = document.documentElement;

    // Remove all skin classes
    htmlElement.classList.remove(
      'skin-retro', 'skin-modern', 'skin-futuristic',
      'skin-dark-analytics', 'skin-coral-training', 'skin-classic-gym',
      'skin-sports-club', 'skin-neon-warrior'
    );

    // Apply the selected skin class
    htmlElement.classList.add(`skin-${skin}`);

    // Persist preference
    localStorage.setItem(this.SKIN_STORAGE_KEY, skin);
  }

  private loadSavedTheme(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'light';
    }

    const saved = localStorage.getItem(this.MODE_STORAGE_KEY) as ThemeMode | null;

    if (saved) {
      return saved;
    }

    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  private loadSavedSkin(): ThemeSkin {
    if (typeof localStorage === 'undefined') {
      return 'modern';
    }

    const saved = localStorage.getItem(this.SKIN_STORAGE_KEY) as ThemeSkin | null;
    const validSkins: ThemeSkin[] = [
      'retro', 'modern', 'futuristic', 'dark-analytics',
      'coral-training', 'classic-gym', 'sports-club', 'neon-warrior'
    ];
    if (saved && validSkins.includes(saved)) {
      return saved;
    }

    return 'modern';
  }
}
