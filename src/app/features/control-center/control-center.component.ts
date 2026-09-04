import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

import { CurrentUserService } from '../../core/services/current-user.service';
import { RecommendationTabsComponent } from './recommendation-tabs.component';
import { PlanListComponent } from './plan-list.component';

/**
 * Athlete-facing Control Center shell.
 *
 * Standalone, OnPush, signal-driven, inject()-based. Composes the athlete's
 * two areas — {@link RecommendationTabsComponent} (recommendations grouped by
 * type) and {@link PlanListComponent} (assigned plans with activation and
 * per-item check-off) — inside a `MatTabsModule` layout consistent with the
 * professional {@link ManagementComponent} shell.
 *
 * The signed-in athlete's id is resolved once from {@link CurrentUserService}
 * and passed to each child via its `[athleteId]` input.
 *
 * This component is the target of the lazy `control-center` route defined in
 * `app.routes.ts` (task 6.1); its class name/export is unchanged so the route
 * keeps resolving.
 *
 * Requirements covered:
 * - 3.1/3.4: hosts the Control Center displayed at the `/control-center` route.
 * - 8.1: presents the athlete's recommendation lists grouped by type.
 */
@Component({
  selector: 'app-control-center',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTabsModule,
    RecommendationTabsComponent,
    PlanListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="control-center-container">
      <h1 class="page-title">Centro de control</h1>
      <p class="page-subtitle">
        Revisá tus recomendaciones y seguí tus planes asignados
      </p>

      <mat-tab-group class="control-center-tabs">
        <!-- Recomendaciones -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>recommend</mat-icon>
            <span class="tab-label-text">Recomendaciones</span>
          </ng-template>
          <div class="tab-content">
            <app-recommendation-tabs [athleteId]="athleteId()"></app-recommendation-tabs>
          </div>
        </mat-tab>

        <!-- Planes -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>assignment</mat-icon>
            <span class="tab-label-text">Planes</span>
          </ng-template>
          <div class="tab-content">
            <app-plan-list [athleteId]="athleteId()"></app-plan-list>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .control-center-container {
        padding: 1.5rem;
      }

      .page-title {
        margin: 0;
      }

      .page-subtitle {
        margin: 0.25rem 0 1rem;
        color: var(--mat-sys-on-surface-variant, #616161);
      }

      .tab-label-text {
        margin-left: 0.5rem;
      }

      .tab-content {
        padding: 1rem 0;
      }
    `,
  ],
})
export class ControlCenterComponent {
  private readonly currentUser = inject(CurrentUserService);

  /** The signed-in athlete's id, resolved from the shared user service. */
  protected readonly athleteId = this.currentUser.userId;
}
