import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { CurrentUserService } from '../../core/services/current-user.service';
import { MOCK_ATHLETES } from '../../mock-data/athletes.data';
import {
  AssignmentMethod,
  AssignmentResult,
  Task,
} from '../../core/models/management.model';

/** Maximum number of athletes allowed in a single bulk assignment. */
const BULK_MAX = 500;

/** Minimum number of athletes required to assign a Task. */
const SELECTION_MIN = 1;

/** A selectable athlete option for the assignment picker. */
interface AthleteOption {
  id: string;
  name: string;
}

/**
 * Professional-facing Task assignment surface.
 *
 * Standalone, OnPush, signal-driven. Lets a professional pick one of their own
 * Tasks, choose an assignment method (direct, message-based, or bulk 1..500),
 * select one or more athletes, and assign the Task via
 * {@link MockTaskService.assignTask}. The signed-in professional's id is
 * resolved from {@link CurrentUserService}.
 *
 * Requirements covered:
 * - 6.1/6.2/6.3: all three methods create one TaskAssignment per selected
 *   athlete (bulk fans out over the selection).
 * - 6.4: the three methods are presented as available options.
 * - 6.5: an empty selection is rejected with a validation message while the
 *   current selection state is retained (the message appears synchronously,
 *   well within the 2s bound).
 * - 6.6: a bulk selection larger than {@link BULK_MAX} is rejected with the
 *   max-athletes message and the selection is retained.
 * - 6.7: duplicate `(taskId, athleteId)` pairs are skipped by the store; the
 *   skipped count from {@link AssignmentResult} is reported to the user.
 * - 6.8: a bulk rollback surfaces the "bulk assignment did not complete" error.
 */
@Component({
  selector: 'app-task-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './task-assignment.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './task-assignment.component.scss',
})
export class TaskAssignmentComponent {
  private readonly taskService = inject(MockTaskService);
  private readonly currentUser = inject(CurrentUserService);

  /**
   * Emitted after at least one assignment is successfully created, so the
   * parent shell can refresh the Progress view (which otherwise only loads on
   * init and would not show freshly created assignments).
   */
  readonly assigned = output<void>();

  /** Expose the enum to the template for the method toggle. */
  readonly AssignmentMethod = AssignmentMethod;

  /** Exposed bounds for the template. */
  readonly bulkMax = BULK_MAX;

  /** The signed-in professional's id. */
  readonly professionalId = computed(() => this.currentUser.userId());

  /**
   * The professional's Tasks available for assignment, derived reactively from
   * the store so a Task created in the Tasks tab appears here immediately
   * (no reload needed).
   */
  readonly tasks = computed<Task[]>(() =>
    this.taskService.tasks$().filter(task => task.professionalId === this.professionalId()),
  );

  /** True while the professional's Tasks are being loaded. */
  readonly loading = signal<boolean>(false);

  /** True while an assignment request is in flight. */
  readonly assigning = signal<boolean>(false);

  /** All athletes that can be assigned a Task. */
  readonly athletes = signal<AthleteOption[]>(
    MOCK_ATHLETES.map(athlete => ({ id: athlete.id, name: athlete.fullName })),
  );

  /** The currently selected Task id (null when none chosen). */
  readonly selectedTaskId = signal<string | null>(null);

  /** The currently chosen assignment method. */
  readonly method = signal<AssignmentMethod>(AssignmentMethod.Direct);

  /** The set of selected athlete ids. */
  readonly selectedAthleteIds = signal<string[]>([]);

  /** A validation message (empty selection / bulk over the max). */
  readonly validationMessage = signal<string | null>(null);

  /** A general error message, e.g. a bulk rollback failure. */
  readonly errorMessage = signal<string | null>(null);

  /** A success summary reporting created and skipped counts. */
  readonly successMessage = signal<string | null>(null);

  /** True when at least one athlete is selected. */
  readonly hasSelection = computed(
    () => this.selectedAthleteIds().length >= SELECTION_MIN,
  );

  /** True when the given athlete is currently selected. */
  isSelected(athleteId: string): boolean {
    return this.selectedAthleteIds().includes(athleteId);
  }

  /** Toggle an athlete's selection state, clearing stale messages. */
  toggleAthlete(athleteId: string, checked: boolean): void {
    this.clearMessages();
    this.selectedAthleteIds.update(ids => {
      if (checked) {
        return ids.includes(athleteId) ? ids : [...ids, athleteId];
      }
      return ids.filter(id => id !== athleteId);
    });
  }

  /** Update the chosen assignment method, clearing stale messages. */
  onMethodChange(method: AssignmentMethod): void {
    this.clearMessages();
    this.method.set(method);
  }

  /** Update the chosen Task, clearing stale messages. */
  onTaskChange(taskId: string): void {
    this.clearMessages();
    this.selectedTaskId.set(taskId);
  }

  /**
   * Assign the selected Task to the selected athletes through the chosen
   * method. Rejects (retaining the selection) when no Task is chosen, when the
   * selection is empty, or when a bulk selection exceeds {@link BULK_MAX}. On
   * success reports the created and skipped counts; on a bulk rollback surfaces
   * the "bulk assignment did not complete" error.
   */
  assign(): void {
    this.clearMessages();

    const taskId = this.selectedTaskId();
    if (!taskId) {
      this.validationMessage.set('Seleccioná una tarea para asignar');
      return;
    }

    const athleteIds = this.selectedAthleteIds();

    // Requirement 6.5: reject an empty selection, retaining the selection state.
    if (athleteIds.length < SELECTION_MIN) {
      this.validationMessage.set('Seleccioná al menos un atleta');
      return;
    }

    const method = this.method();

    // Requirement 6.6: reject a bulk selection larger than the max, retaining
    // the selection state, with the max-athletes message.
    if (method === AssignmentMethod.Bulk && athleteIds.length > BULK_MAX) {
      this.validationMessage.set(
        `Una asignación en masa permite como máximo ${BULK_MAX} atletas`,
      );
      return;
    }

    this.assigning.set(true);
    this.taskService.assignTask(taskId, athleteIds, method).subscribe({
      next: (result: AssignmentResult) => {
        this.reportResult(result);
        this.assigning.set(false);
      },
      error: (err: unknown) => {
        this.handleError(err);
        this.assigning.set(false);
      },
    });
  }

  /**
   * Report the outcome of a successful assignment: how many assignments were
   * created and how many athletes were skipped as duplicates (Requirement 6.7).
   */
  private reportResult(result: AssignmentResult): void {
    const createdCount = result.created.length;
    const skippedCount = result.skipped.length;
    const parts = [`${createdCount} asignación(es) creada(s)`];
    if (skippedCount > 0) {
      parts.push(`${skippedCount} omitida(s) (ya asignada(s))`);
    }
    this.successMessage.set(parts.join(', '));
    // Clear the selection after a successful assignment; keep the chosen task.
    this.selectedAthleteIds.set([]);

    if (createdCount > 0) {
      // Seed demo progress for the new assignments so the Progress tab shows
      // realistic, non-zero progress, then notify the shell to refresh it.
      const newAssignmentIds = result.created.map(assignment => assignment.id);
      this.taskService.seedMockProgress(newAssignmentIds).subscribe({
        next: () => this.assigned.emit(),
        error: () => this.assigned.emit(),
      });
    }
  }

  /**
   * Surface an assignment error. Bulk rollbacks report that the bulk
   * assignment did not complete (Requirement 6.8); the selection is retained.
   */
  private handleError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (this.method() === AssignmentMethod.Bulk) {
      this.errorMessage.set('La asignación en masa no se completó');
      return;
    }
    this.errorMessage.set(message);
  }

  /** Clear all transient messages. */
  private clearMessages(): void {
    this.validationMessage.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
