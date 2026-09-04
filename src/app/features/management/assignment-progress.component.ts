import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { AssignmentProgress, ItemProgress } from '../../core/models/management.model';

/**
 * Professional-facing assignment progress view.
 *
 * Standalone, OnPush, signal-driven. Given the id of a {@link TaskAssignment}
 * (via the required `assignmentId` signal input), it shows the assigned
 * athlete's identifying name and, for each Item in the assigned Task, a
 * completion state of "completed" or "not completed", read from
 * {@link MockTaskService.getProgress}.
 *
 * Requirements covered:
 * - 7.1: the assigned athlete's identifying name is displayed for the
 *   TaskAssignment.
 * - 7.2/7.3: each Item is shown with a "completed" / "not completed" state that
 *   reflects the recorded ItemCompletion state (re-read on {@link refresh}).
 * - 7.4: when no athlete is assigned (`athleteName` is null), a "no athlete
 *   assigned" indication is shown and every Item is rendered "not completed".
 * - 7.5: when `getProgress` errors, a "progress unavailable" error indication is
 *   shown and NO item completion state is rendered for that assignment.
 */
@Component({
  selector: 'app-assignment-progress',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
  ],
  templateUrl: './assignment-progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './assignment-progress.component.scss',
})
export class AssignmentProgressComponent implements OnInit {
  private readonly taskService = inject(MockTaskService);

  /** The id of the TaskAssignment whose progress is displayed. */
  readonly assignmentId = input.required<string>();

  /** The last successfully loaded progress, or null before the first load. */
  readonly progress = signal<AssignmentProgress | null>(null);

  /**
   * True when progress could not be retrieved for the assignment. When set, no
   * item completion state is rendered (Requirement 7.5).
   */
  readonly unavailable = signal<boolean>(false);

  /** True while the assignment's progress is being read from the store. */
  readonly loading = signal<boolean>(false);

  /** The assigned athlete's identifying name, or null when none is assigned. */
  readonly athleteName = computed(() => this.progress()?.athleteName ?? null);

  /** True when the loaded assignment has no assigned athlete (Requirement 7.4). */
  readonly hasNoAthlete = computed(
    () => !this.unavailable() && this.progress() !== null && this.athleteName() === null,
  );

  /**
   * The per-item completion states to render. Empty while unavailable so no
   * item state is shown on an errored assignment (Requirement 7.5).
   */
  readonly items = computed<ItemProgress[]>(() =>
    this.unavailable() ? [] : (this.progress()?.items ?? []),
  );

  /** Completion percentage (0..100) for the assignment; 0 while unavailable. */
  readonly percentage = computed<number>(() =>
    this.unavailable() ? 0 : (this.progress()?.percentage ?? 0),
  );

  /** "completed / total" counts for the progress summary label. */
  readonly completedCount = computed<number>(() => this.progress()?.completedCount ?? 0);
  readonly totalCount = computed<number>(() => this.progress()?.totalCount ?? 0);

  ngOnInit(): void {
    this.refresh();
  }

  /**
   * Re-read the assignment's progress from the store. Reflects the athlete's
   * current completions on every call (Requirement 7.3). On error, marks the
   * progress unavailable and clears any previously rendered item state
   * (Requirement 7.5).
   */
  refresh(): void {
    this.loading.set(true);
    this.taskService.getProgress(this.assignmentId()).subscribe({
      next: progress => {
        this.unavailable.set(false);
        this.progress.set(progress);
        this.loading.set(false);
      },
      error: () => {
        this.unavailable.set(true);
        this.progress.set(null);
        this.loading.set(false);
      },
    });
  }
}
