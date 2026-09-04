import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** A single checkable item within a plan. */
export interface PlanItem {
  id: string;
  label: string;
  completed: boolean;
}

/** An athlete-facing plan with a title, an icon and its checkable items. */
export interface PlanView {
  id: string;
  title: string;
  /** Material icon shown next to the title. */
  icon: string;
  /** Accent color for the icon. */
  color: string;
  /** True when this plan is currently active for the athlete. */
  active: boolean;
  items: PlanItem[];
}

/**
 * Build the 10 items of a plan from a list of labels, giving each a stable id
 * scoped to its plan (`<planId>-item-<n>`). All items start not completed.
 */
function buildItems(planId: string, labels: string[]): PlanItem[] {
  return labels.map((label, index) => ({
    id: `${planId}-item-${index + 1}`,
    label,
    completed: false,
  }));
}

/**
 * Hardcoded demo plans for the athlete Control Center.
 *
 * TODO(backend): replace this seed with a call to the backend to fetch the
 * athlete's plans (e.g. a `PlanService.getPlansForAthlete(athleteId)`), keeping
 * the {@link PlanView} shape. The component holds the plans in a local signal
 * precisely so swapping this seed for an HTTP call is a one-line change.
 */
function seedPlans(): PlanView[] {
  return [
    {
      id: 'plan-exercise',
      title: 'Rutina de ejercicios',
      icon: 'fitness_center',
      color: '#1565c0',
      active: false,
      items: buildItems('plan-exercise', [
        'Calentamiento articular 10 min',
        'Movilidad de cadera y tobillos',
        'Sentadillas 4x12',
        'Peso muerto rumano 4x10',
        'Press de banca 4x10',
        'Remo con barra 4x12',
        'Zancadas caminando 3x20',
        'Plancha abdominal 3x45 s',
        'Trabajo de core anti-rotación',
        'Enfriamiento y elongación 10 min',
      ]),
    },
    {
      id: 'plan-nutrition',
      title: 'Guía de nutrición',
      icon: 'restaurant',
      color: '#2e7d32',
      active: false,
      items: buildItems('plan-nutrition', [
        'Tomar 2,5 L de agua en el día',
        'Desayuno con proteína y fruta',
        'Colación de media mañana',
        'Almuerzo con vegetales y proteína magra',
        'Merienda con carbohidratos complejos',
        'Comida post-entrenamiento dentro de 1 h',
        'Cena liviana antes de las 22 h',
        'Evitar bebidas azucaradas',
        'Registrar las comidas del día',
        'Suplementación indicada por el profesional',
      ]),
    },
    {
      id: 'plan-kinesiology',
      title: 'Tareas de kinesiología',
      icon: 'healing',
      color: '#e65100',
      active: false,
      items: buildItems('plan-kinesiology', [
        'Aplicar frío/calor según indicación',
        'Ejercicios de movilidad asistida',
        'Estiramiento de isquiotibiales 3x30 s',
        'Fortalecimiento excéntrico de cuádriceps',
        'Trabajo de propiocepción en una pierna',
        'Ejercicios de banda elástica',
        'Liberación miofascial con rodillo',
        'Control de dolor y molestias',
        'Ejercicios respiratorios de relajación',
        'Registrar avances para el kinesiólogo',
      ]),
    },
  ];
}

/**
 * Athlete-facing plan list.
 *
 * Standalone, OnPush, signal-driven. Shows the athlete's plans (currently a
 * hardcoded demo seed, pending a backend call) as cards with checkable items.
 * Each plan can be toggled active/inactive independently; the checkboxes track
 * per-item completion. All state is local to the component so it no longer
 * depends on `MockTaskService` / `TaskAssignment`.
 *
 * @see seedPlans for the backend-replacement TODO.
 */
@Component({
  selector: 'app-plan-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="plan-list">
      @if (plans().length === 0) {
        <p class="plan-list__empty">Todavía no tenés planes asignados.</p>
      }

      <div role="list" aria-label="Planes asignados">
        @for (plan of plans(); track plan.id) {
          <mat-card
            role="listitem"
            class="plan-list__card"
            [class.plan-list__card--active]="plan.active"
            [attr.aria-label]="plan.title + (plan.active ? ' (activo)' : '')"
          >
            <mat-card-header>
              <mat-icon
                mat-card-avatar
                aria-hidden="true"
                [style.color]="plan.color"
              >
                {{ plan.icon }}
              </mat-icon>
              <mat-card-title>{{ plan.title }}</mat-card-title>
              <mat-card-subtitle>
                {{ completedCount(plan) }} de {{ plan.items.length }} completados
              </mat-card-subtitle>
              @if (plan.active) {
                <mat-chip-set class="plan-list__active-indicator">
                  <mat-chip color="primary" highlighted disableRipple aria-label="Plan activo">
                    <mat-icon matChipAvatar aria-hidden="true">check_circle</mat-icon>
                    Activo
                  </mat-chip>
                </mat-chip-set>
              }
            </mat-card-header>

            <mat-card-content>
              <ul class="plan-list__items" aria-label="Items del plan">
                @for (item of plan.items; track item.id) {
                  <li class="plan-list__item">
                    <mat-checkbox
                      [checked]="item.completed"
                      [disabled]="!plan.active"
                      [attr.aria-label]="
                        item.label + (item.completed ? ', completado' : ', no completado')
                      "
                      (change)="onToggleItem(plan.id, item.id, $event)"
                    >
                      {{ item.label }}
                    </mat-checkbox>
                  </li>
                }
              </ul>
            </mat-card-content>

            <mat-card-actions>
              <button
                mat-stroked-button
                type="button"
                [attr.aria-label]="
                  (plan.active ? 'Desactivar' : 'Activar') + ' el plan ' + plan.title
                "
                (click)="onToggleActive(plan.id)"
              >
                {{ plan.active ? 'Desactivar' : 'Activar' }}
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .plan-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .plan-list__card--active {
        border: 2px solid var(--mat-sys-primary, #1976d2);
      }

      .plan-list__items {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
    `,
  ],
})
export class PlanListComponent {
  /**
   * The signed-in athlete's id. Provided by the parent
   * {@link ControlCenterComponent}. Currently unused by the local seed; it will
   * be forwarded to the backend call that replaces {@link seedPlans}.
   */
  readonly athleteId = input<string>();

  /** The athlete's plans. Local state, ready to be fed from the backend. */
  readonly plans = signal<PlanView[]>(seedPlans());

  /** Number of completed items in a plan (used for the card subtitle). */
  completedCount(plan: PlanView): number {
    return plan.items.filter(item => item.completed).length;
  }

  /**
   * Toggle a plan's active state. Plans are independent: activating one does not
   * deactivate the others.
   */
  onToggleActive(planId: string): void {
    this.plans.update(plans =>
      plans.map(plan =>
        plan.id === planId ? { ...plan, active: !plan.active } : plan,
      ),
    );
  }

  /** Reflect a checkbox change for a single item within a plan. */
  onToggleItem(planId: string, itemId: string, event: MatCheckboxChange): void {
    this.plans.update(plans =>
      plans.map(plan =>
        plan.id === planId
          ? {
              ...plan,
              items: plan.items.map(item =>
                item.id === itemId ? { ...item, completed: event.checked } : item,
              ),
            }
          : plan,
      ),
    );
  }
}
