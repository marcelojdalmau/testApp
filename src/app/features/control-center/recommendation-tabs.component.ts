import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MockClubService } from '../../mock-data/services/mock-club.service';
import { StaffRecommendation } from '../../core/models/club.model';

/** The distinct recommendation types in the order they should surface. */
const RECOMMENDATION_TYPES: StaffRecommendation['type'][] = [
  'diet',
  'exercise',
  'rehabilitation',
  'psychological',
  'tactical',
];

/** A group of recommendations of a single type, rendered as one tab. */
export interface RecommendationGroup {
  type: StaffRecommendation['type'];
  label: string;
  recommendations: StaffRecommendation[];
}

/**
 * Athlete-facing recommendation tabs.
 *
 * Standalone, OnPush, signal-driven. Given the signed-in athlete's id (via the
 * `athleteId` signal input, passed by {@link ControlCenterComponent}), it shows
 * the athlete's own recommendations grouped by type. The grouping/label/icon
 * helpers are migrated from the former ManagementComponent's athlete view and
 * mirror the equivalents in `AthleteProfileComponent`.
 *
 * Requirements covered:
 * - 8.1: recommendations are grouped by type, with exactly one group per
 *   distinct present type (each group has >= 1 recommendation).
 * - 8.2: only recommendations owned by the signed-in athlete are shown
 *   (filtered by `playerId === athleteId`).
 * - 8.3: recommendations within each group are ordered most-recent-first by
 *   `createdAt` descending.
 * - 8.4: types with zero recommendations are omitted (no empty groups).
 * - 8.5: on load failure the previously displayed recommendations are retained
 *   unchanged and a load-error indication is shown.
 */
@Component({
  selector: 'app-recommendation-tabs',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="recommendation-tabs">
      @if (loadError()) {
        <p class="load-error" role="alert">
          <mat-icon aria-hidden="true">error_outline</mat-icon>
          No se pudieron cargar las recomendaciones.
        </p>
      }

      @if (loading() && recommendations().length === 0) {
        <div class="loading-state" role="status" aria-live="polite">
          <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
          <p>Cargando recomendaciones...</p>
        </div>
      } @else if (groupedRecommendations().length > 0) {
        <mat-tab-group aria-label="Recomendaciones por tipo">
          @for (group of groupedRecommendations(); track group.type) {
            <mat-tab [label]="group.label">
              <div class="group-content">
                @for (rec of group.recommendations; track rec.id) {
                  <mat-card class="recommendation-card">
                    <mat-card-header>
                      <mat-icon
                        mat-card-avatar
                        aria-hidden="true"
                        [style.color]="getRecommendationColor(rec.type)"
                      >
                        {{ getRecommendationIcon(rec.type) }}
                      </mat-icon>
                      <mat-card-title>{{ rec.title }}</mat-card-title>
                      <mat-card-subtitle>
                        {{ rec.staffName }} · {{ rec.staffRole }}
                      </mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content>
                      <p>{{ rec.description }}</p>
                      @if (rec.details.length > 0) {
                        <ul>
                          @for (detail of rec.details; track detail) {
                            <li>{{ detail }}</li>
                          }
                        </ul>
                      }
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            </mat-tab>
          }
        </mat-tab-group>
      } @else if (!loadError()) {
        <p class="empty">Todavía no tenés recomendaciones.</p>
      }
    </section>
  `,
  styles: [
    `
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 2rem 1rem;
        color: var(--mat-sys-on-surface-variant, #616161);
      }

      .load-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--mat-sys-error, #b3261e);
      }
    `,
  ],
})
export class RecommendationTabsComponent {
  private readonly clubService = inject(MockClubService);

  /** The signed-in athlete's (owner) id. */
  readonly athleteId = input<string>();

  /**
   * The last successfully loaded recommendations. Retained unchanged when a
   * subsequent load fails (Requirement 8.5).
   */
  readonly recommendations = signal<StaffRecommendation[]>([]);

  /** True when the most recent load attempt failed (Requirement 8.5). */
  readonly loadError = signal<boolean>(false);

  /** True while recommendations are being loaded from the store. */
  readonly loading = signal<boolean>(false);

  /**
   * The recommendations grouped by type: one group per distinct present type
   * (absent types omitted), each ordered most-recent-first by `createdAt`
   * (Requirements 8.1, 8.3, 8.4).
   */
  readonly groupedRecommendations = computed<RecommendationGroup[]>(() => {
    const recs = this.recommendations();
    const groups: RecommendationGroup[] = [];

    for (const type of RECOMMENDATION_TYPES) {
      const forType = recs
        .filter(rec => rec.type === type)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      if (forType.length > 0) {
        groups.push({ type, label: this.getTypeLabel(type), recommendations: forType });
      }
    }

    return groups;
  });

  constructor() {
    // Reload whenever the athlete id becomes available or changes.
    effect(() => {
      const id = this.athleteId();
      if (id) {
        this.load(id);
      }
    });
  }

  /**
   * Load the athlete's own recommendations. On success the error flag is
   * cleared and the recommendations are replaced. On failure the previously
   * displayed recommendations are retained and the error flag is set
   * (Requirement 8.5). Owner-only filtering keeps only records whose
   * `playerId` equals the athlete id (Requirement 8.2).
   */
  load(athleteId: string): void {
    this.loading.set(true);
    this.clubService.getRecommendationsForPlayer(athleteId).subscribe({
      next: recs => {
        this.loadError.set(false);
        this.recommendations.set(recs.filter(rec => rec.playerId === athleteId));
        this.loading.set(false);
      },
      error: () => {
        // Retain previously displayed data unchanged; flag the failure.
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Human-readable label for a recommendation type. */
  getTypeLabel(type: StaffRecommendation['type']): string {
    switch (type) {
      case 'diet':
        return 'Alimentación';
      case 'exercise':
        return 'Ejercicio';
      case 'rehabilitation':
        return 'Rehabilitación';
      case 'psychological':
        return 'Psicológico';
      case 'tactical':
        return 'Táctico';
      default:
        return type;
    }
  }

  /** Material icon name for a recommendation type (migrated helper). */
  getRecommendationIcon(type: string): string {
    switch (type) {
      case 'diet':
        return 'restaurant';
      case 'exercise':
        return 'fitness_center';
      case 'rehabilitation':
        return 'healing';
      case 'psychological':
        return 'psychology';
      case 'tactical':
        return 'sports_soccer';
      default:
        return 'assignment';
    }
  }

  /** Accent color for a recommendation type (migrated helper). */
  getRecommendationColor(type: string): string {
    switch (type) {
      case 'diet':
        return '#2e7d32';
      case 'exercise':
        return '#1565c0';
      case 'rehabilitation':
        return '#e65100';
      case 'psychological':
        return '#6a1b9a';
      case 'tactical':
        return '#00838f';
      default:
        return '#616161';
    }
  }
}
