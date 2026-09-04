import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  AssignmentMethod,
  AssignmentProgress,
  AssignmentResult,
  ItemCompletion,
  ItemProgress,
  Task,
  TaskAssignment,
  TaskInput
} from '../../core/models/management.model';
import { MOCK_ATHLETES } from '../athletes.data';
import { MockItemService } from './mock-item.service';
import { readArray, writeArray, nextIdFrom } from './mock-store-persistence';

/** localStorage keys under which the Task-related stores are persisted. */
const TASKS_KEY = 'sora-sport-mock-tasks';
const ASSIGNMENTS_KEY = 'sora-sport-mock-assignments';
const COMPLETIONS_KEY = 'sora-sport-mock-completions';

/** id prefixes / counter conventions for the persisted records. */
const TASK_ID_PREFIX = 'task-';
const ASSIGNMENT_ID_PREFIX = 'assignment-';
const COMPLETION_ID_PREFIX = 'completion-';

/**
 * Session-persistent, signal-backed store for {@link Task} records, along with
 * the {@link TaskAssignment} and {@link ItemCompletion} records that bridge the
 * professional and athlete workflows.
 *
 * Unlike the other mock services (which are stateless and return static data),
 * this service maintains mutable in-memory stores for the current browser
 * session. This is a deliberate, additive extension of the mock-service
 * pattern: methods still return `Observable<T>` via `of(...)` / `throwError`,
 * but mutations update internal signal-backed arrays.
 *
 * Validation bounds (re-validated defensively here):
 * - name: length 1..100
 * - description: length 0..1000
 * - itemIds: length 1..100
 *
 * This service implements Task CRUD, Task assignment (creation with dedup,
 * bulk bound enforcement, and atomic rollback, plus assignment reads), plan
 * activation (at most one active plan per athlete), and item completion
 * (recording/removing completions and building the professional progress view).
 */
@Injectable({
  providedIn: 'root'
})
export class MockTaskService {
  /** Internal signal-backed store of all Tasks across professionals. */
  private readonly tasks = signal<Task[]>(readArray<Task>(TASKS_KEY));

  /** Internal signal-backed store of all TaskAssignments. */
  private readonly assignments = signal<TaskAssignment[]>(readArray<TaskAssignment>(ASSIGNMENTS_KEY));

  /** Internal signal-backed store of all ItemCompletions. */
  private readonly completions = signal<ItemCompletion[]>(readArray<ItemCompletion>(COMPLETIONS_KEY));

  /**
   * Read-only reactive views of the stores, so components can derive their own
   * `computed` state that updates immediately when the store mutates (e.g. the
   * assignment tab's task list reflects a task created in the tasks tab without
   * a reload). The `getX...` Observable methods remain for one-shot reads.
   */
  readonly tasks$: Signal<readonly Task[]> = this.tasks.asReadonly();
  readonly assignments$: Signal<readonly TaskAssignment[]> = this.assignments.asReadonly();
  readonly completions$: Signal<readonly ItemCompletion[]> = this.completions.asReadonly();

  /** Monotonic counter used to generate unique Task ids (restored on reload). */
  private nextTaskId = nextIdFrom(this.tasks().map(t => t.id), TASK_ID_PREFIX);

  /** Monotonic counter used to generate unique TaskAssignment ids (restored on reload). */
  private nextAssignmentId = nextIdFrom(
    this.assignments().map(a => a.id),
    ASSIGNMENT_ID_PREFIX,
  );

  /** Monotonic counter used to generate unique ItemCompletion ids (restored on reload). */
  private nextCompletionId = nextIdFrom(
    this.completions().map(c => c.id),
    COMPLETION_ID_PREFIX,
  );

  /** Apply an update to the Task store and persist the result to localStorage. */
  private setTasks(updater: (tasks: Task[]) => Task[]): void {
    this.tasks.update(current => {
      const next = updater(current);
      writeArray(TASKS_KEY, next);
      return next;
    });
  }

  /** Apply an update to the TaskAssignment store and persist to localStorage. */
  private setAssignments(updater: (assignments: TaskAssignment[]) => TaskAssignment[]): void {
    this.assignments.update(current => {
      const next = updater(current);
      writeArray(ASSIGNMENTS_KEY, next);
      return next;
    });
  }

  /** Apply an update to the ItemCompletion store and persist to localStorage. */
  private setCompletions(updater: (completions: ItemCompletion[]) => ItemCompletion[]): void {
    this.completions.update(current => {
      const next = updater(current);
      writeArray(COMPLETIONS_KEY, next);
      return next;
    });
  }

  /**
   * Item store used to resolve human-readable Item names for the progress
   * view. Injected rather than passed on the model because Tasks store only
   * ordered `itemIds`; {@link MockItemService} has no dependency back on this
   * service, so there is no circular DI.
   */
  private readonly itemService = inject(MockItemService);

  /** Return the Tasks owned by the given professional (owner-only). */
  getTasksForProfessional(professionalId: string): Observable<Task[]> {
    return of(this.tasks().filter(task => task.professionalId === professionalId));
  }

  /**
   * Create a new Task. Assigns `id` and `createdAt` in the store and persists
   * the name, description, and ordered `itemIds` exactly as provided.
   * Rejects via `throwError` when a validation bound is violated.
   */
  createTask(input: TaskInput): Observable<Task> {
    const validationError = this.validateInput(input);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    const task: Task = {
      id: `${TASK_ID_PREFIX}${this.nextTaskId++}`,
      professionalId: input.professionalId,
      name: input.name,
      description: input.description,
      itemIds: [...input.itemIds],
      createdAt: new Date().toISOString()
    };

    this.setTasks(tasks => [...tasks, task]);
    return of(task);
  }

  /**
   * Update an existing owned Task. Persists the updated name, description, and
   * ordered `itemIds` exactly as provided. Rejects via `throwError` when the id
   * is not owned by `input.professionalId` / not found, or when a bound is
   * violated.
   */
  updateTask(id: string, input: TaskInput): Observable<Task> {
    const validationError = this.validateInput(input);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    const existing = this.tasks().find(
      task => task.id === id && task.professionalId === input.professionalId
    );
    if (!existing) {
      return throwError(() => new Error('No se encontró la tarea'));
    }

    const updated: Task = {
      ...existing,
      name: input.name,
      description: input.description,
      itemIds: [...input.itemIds]
    };

    this.setTasks(tasks => tasks.map(task => (task.id === id ? updated : task)));
    return of(updated);
  }

  /**
   * Delete an owned Task. Rejects via `throwError` when the id is not found.
   * Ownership is enforced when a `professionalId` is provided.
   */
  deleteTask(id: string, professionalId?: string): Observable<void> {
    const existing = this.tasks().find(
      task => task.id === id && (professionalId === undefined || task.professionalId === professionalId)
    );
    if (!existing) {
      return throwError(() => new Error('No se encontró la tarea'));
    }

    this.setTasks(tasks => tasks.filter(task => task.id !== id));
    return of(undefined);
  }

  /**
   * Assign a Task to one or more athletes through the given method.
   *
   * For each requested athlete, exactly one {@link TaskAssignment} is created
   * (with the correct `taskId`, `athleteId`, and `method`) unless a
   * `(taskId, athleteId)` assignment already exists, in which case the athlete
   * id is added to {@link AssignmentResult.skipped} and no duplicate is created.
   *
   * For {@link AssignmentMethod.Bulk}, the `athleteIds` length must be between
   * 1 and 500; violations are rejected via `throwError`. Bulk assignment is
   * all-or-nothing: the new assignments are staged in a local array and only
   * committed to the store once every creation has succeeded. If any staged
   * creation fails, the staged set is discarded and the store is left
   * unchanged (rollback), and the returned Observable errors.
   *
   * @param taskId the Task being assigned
   * @param athleteIds the athletes to assign the Task to
   * @param method how the Task is being assigned
   */
  assignTask(
    taskId: string,
    athleteIds: string[],
    method: AssignmentMethod
  ): Observable<AssignmentResult> {
    const ids = athleteIds ?? [];

    // Enforce the bulk bound (1..500) up front, before any staging.
    if (method === AssignmentMethod.Bulk && (ids.length < 1 || ids.length > 500)) {
      return throwError(
        () => new Error('La asignación en masa requiere entre 1 y 500 atletas')
      );
    }

    const existing = this.assignments();
    const staged: TaskAssignment[] = [];
    const skipped: string[] = [];
    // Track pairs already accounted for (both persisted and staged) so that a
    // duplicate athlete id within the same request is only created once.
    const seen = new Set<string>(
      existing
        .filter(assignment => assignment.taskId === taskId)
        .map(assignment => assignment.athleteId)
    );

    try {
      for (const athleteId of ids) {
        if (seen.has(athleteId)) {
          skipped.push(athleteId);
          continue;
        }
        seen.add(athleteId);
        // Stage the creation. `createAssignmentRecord` is the injectable seam
        // used by the atomicity/rollback property test to simulate a failure.
        staged.push(this.createAssignmentRecord(taskId, athleteId, method));
      }
    } catch (error) {
      // Any failure during staging discards the entire staged set; the store
      // is never mutated, so it remains exactly as it was before the call.
      return throwError(() =>
        error instanceof Error
          ? new Error(`La asignación en masa no se completó: ${error.message}`)
          : new Error('La asignación en masa no se completó')
      );
    }

    // Commit atomically: a single signal update applies every staged record.
    if (staged.length > 0) {
      this.setAssignments(assignments => [...assignments, ...staged]);
    }

    return of({ created: staged, skipped });
  }

  /**
   * Seed mock {@link ItemCompletion} records for the given assignments so the
   * professional Progress view shows realistic, non-zero progress in the demo.
   * For each assignment, a random prefix of the Task's ordered items is marked
   * completed (0..all), skipping any assignment that already has completions so
   * repeated calls are idempotent. This is demo-only data invoked from the UI
   * after an assignment (kept out of {@link assignTask} so the assignment
   * contract stays pure), and it follows the normal persistence path so the
   * seeded progress survives a reload.
   */
  seedMockProgress(assignmentIds: string[]): Observable<void> {
    const seeded: ItemCompletion[] = [];
    const existingByAssignment = new Set(
      this.completions().map(completion => completion.taskAssignmentId),
    );

    for (const assignmentId of assignmentIds) {
      if (existingByAssignment.has(assignmentId)) {
        continue;
      }
      const assignment = this.assignments().find(a => a.id === assignmentId);
      if (!assignment) {
        continue;
      }
      const task = this.tasks().find(t => t.id === assignment.taskId);
      const itemIds = task?.itemIds ?? [];
      if (itemIds.length === 0) {
        continue;
      }
      // Complete a random count of the leading items (0..itemIds.length).
      const completedCount = Math.floor(Math.random() * (itemIds.length + 1));
      for (let i = 0; i < completedCount; i++) {
        seeded.push({
          id: `${COMPLETION_ID_PREFIX}${this.nextCompletionId++}`,
          taskAssignmentId: assignmentId,
          itemId: itemIds[i],
          athleteId: assignment.athleteId,
          completedAt: new Date().toISOString(),
        });
      }
    }

    if (seeded.length > 0) {
      this.setCompletions(completions => [...completions, ...seeded]);
    }
    return of(undefined);
  }

  /**
   * Return the TaskAssignments whose Task belongs to the given professional.
   * Joins the assignment store against the Task store on `taskId` and filters
   * by `task.professionalId`.
   */
  getAssignmentsForProfessional(professionalId: string): Observable<TaskAssignment[]> {
    const ownedTaskIds = new Set(
      this.tasks()
        .filter(task => task.professionalId === professionalId)
        .map(task => task.id)
    );
    return of(
      this.assignments().filter(assignment => ownedTaskIds.has(assignment.taskId))
    );
  }

  /** Return the TaskAssignments belonging to the given athlete. */
  getAssignmentsForAthlete(athleteId: string): Observable<TaskAssignment[]> {
    return of(
      this.assignments().filter(assignment => assignment.athleteId === athleteId)
    );
  }

  /**
   * Build a single {@link TaskAssignment} record with a fresh id and an ISO
   * `assignedAt` timestamp, defaulting `active` to `false`.
   *
   * This is a dedicated seam so the bulk-atomicity property test (subtask 3.6)
   * can inject a failure during staging and assert the store is left unchanged.
   */
  private createAssignmentRecord(
    taskId: string,
    athleteId: string,
    method: AssignmentMethod
  ): TaskAssignment {
    return {
      id: `${ASSIGNMENT_ID_PREFIX}${this.nextAssignmentId++}`,
      taskId,
      athleteId,
      assignedAt: new Date().toISOString(),
      method,
      active: false
    };
  }

  /**
   * Set the given assignment as the athlete's active Plan, enforcing at most
   * one active Plan per athlete.
   *
   * The assignment must belong to `athleteId`; otherwise the call is rejected
   * via `throwError` and no active state changes. Re-activating the plan that
   * is already active is a no-op. Otherwise the target assignment is marked
   * `active = true` and every other assignment for that athlete is cleared to
   * `active = false`, so the athlete ends with exactly one active plan.
   *
   * @param athleteId the athlete whose plan is being activated
   * @param assignmentId the assignment to activate
   */
  activatePlan(athleteId: string, assignmentId: string): Observable<void> {
    const target = this.assignments().find(assignment => assignment.id === assignmentId);
    if (!target || target.athleteId !== athleteId) {
      return throwError(() => new Error('La asignación no pertenece al atleta'));
    }

    // Re-activating the already-active plan leaves the active state unchanged.
    if (target.active) {
      return of(undefined);
    }

    this.setAssignments(assignments =>
      assignments.map(assignment => {
        if (assignment.athleteId !== athleteId) {
          return assignment;
        }
        // At most one active plan per athlete: only the target stays active.
        return { ...assignment, active: assignment.id === assignmentId };
      })
    );
    return of(undefined);
  }

  /**
   * Return the athlete's currently active Plan, or `null` when none is active.
   */
  getActivePlan(athleteId: string): Observable<TaskAssignment | null> {
    const active = this.assignments().find(
      assignment => assignment.athleteId === athleteId && assignment.active
    );
    return of(active ?? null);
  }

  /**
   * Create or remove an {@link ItemCompletion} for a single Item within an
   * assignment.
   *
   * The completion is only recorded when the assignment exists and belongs to
   * `athleteId`; when it does not, the call is rejected via `throwError` and no
   * record is written (Requirement 10.6).
   *
   * When `completed` is `true`, an {@link ItemCompletion} is created (with a
   * fresh id and an ISO `completedAt`) unless one already exists for the same
   * `(assignmentId, itemId)` pair, keeping the operation idempotent. When
   * `completed` is `false`, the matching completion (if any) is removed.
   *
   * @param assignmentId the assignment the Item belongs to
   * @param itemId the Item being checked off or cleared
   * @param completed whether the Item is now completed
   * @param athleteId the athlete performing the change
   */
  setItemCompletion(
    assignmentId: string,
    itemId: string,
    completed: boolean,
    athleteId: string
  ): Observable<void> {
    const assignment = this.assignments().find(a => a.id === assignmentId);
    if (!assignment || assignment.athleteId !== athleteId) {
      // Reject and write nothing when the assignment is not owned by the athlete.
      return throwError(() => new Error('La asignación no pertenece al atleta'));
    }

    const alreadyRecorded = this.completions().some(
      completion =>
        completion.taskAssignmentId === assignmentId && completion.itemId === itemId
    );

    if (completed) {
      if (!alreadyRecorded) {
        const record: ItemCompletion = {
          id: `${COMPLETION_ID_PREFIX}${this.nextCompletionId++}`,
          taskAssignmentId: assignmentId,
          itemId,
          athleteId,
          completedAt: new Date().toISOString()
        };
        this.setCompletions(completions => [...completions, record]);
      }
    } else if (alreadyRecorded) {
      this.setCompletions(completions =>
        completions.filter(
          completion =>
            !(completion.taskAssignmentId === assignmentId && completion.itemId === itemId)
        )
      );
    }

    return of(undefined);
  }

  /** Return the ItemCompletions recorded for the given assignment. */
  getCompletions(assignmentId: string): Observable<ItemCompletion[]> {
    return of(
      this.completions().filter(
        completion => completion.taskAssignmentId === assignmentId
      )
    );
  }

  /**
   * Build the professional-facing progress view for an assignment.
   *
   * The assignment must exist; otherwise the call is rejected via `throwError`.
   * The associated {@link Task} is resolved via `assignment.taskId`, and the
   * `items` array is built from the Task's ordered `itemIds`, each carrying a
   * `completed` flag derived from whether an {@link ItemCompletion} exists for
   * `(assignmentId, itemId)`.
   *
   * `athleteName` is resolved from {@link MOCK_ATHLETES} by `athleteId`. When
   * the athlete cannot be resolved, `athleteName` is `null` and every Item is
   * reported as not completed (Requirement 7.4).
   */
  getProgress(assignmentId: string): Observable<AssignmentProgress> {
    const assignment = this.assignments().find(a => a.id === assignmentId);
    if (!assignment) {
      return throwError(() => new Error('No se encontró la asignación'));
    }

    const task = this.tasks().find(t => t.id === assignment.taskId);
    const itemIds = task?.itemIds ?? [];
    const athleteName = this.resolveAthleteName(assignment.athleteId);

    // Names are resolved from the owning professional's Item store; when an id
    // no longer resolves, the itemId itself is used as a stable fallback label.
    const itemNames = this.resolveItemNames(task?.professionalId, itemIds);

    const completedItemIds = new Set(
      this.completions()
        .filter(completion => completion.taskAssignmentId === assignmentId)
        .map(completion => completion.itemId)
    );

    const items: ItemProgress[] = itemIds.map(itemId => ({
      itemId,
      itemName: itemNames.get(itemId) ?? itemId,
      // When no athlete is resolvable/assigned, all items are not-completed.
      completed: athleteName !== null && completedItemIds.has(itemId)
    }));

    const totalCount = items.length;
    const completedCount = items.filter(item => item.completed).length;
    const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return of({
      assignmentId,
      athleteId: assignment.athleteId,
      athleteName,
      items,
      completedCount,
      totalCount,
      percentage
    });
  }

  /**
   * Resolve an athlete's display name from the mock athlete data, or `null`
   * when the id does not correspond to a known athlete.
   */
  private resolveAthleteName(athleteId: string): string | null {
    const athlete = MOCK_ATHLETES.find(a => a.id === athleteId);
    return athlete?.fullName ?? null;
  }

  /**
   * Build a lookup of Item id -> Item name for the given item ids, resolving
   * names from the Item store. Items that cannot be resolved are simply absent
   * from the map, and callers fall back to the itemId as the label.
   */
  private resolveItemNames(
    professionalId: string | undefined,
    itemIds: string[]
  ): Map<string, string> {
    const names = new Map<string, string>();
    if (!professionalId || itemIds.length === 0) {
      return names;
    }
    const wanted = new Set(itemIds);
    // getItemsForProfessional returns synchronously via of(...); subscribe to
    // read the current snapshot without introducing async coupling.
    this.itemService.getItemsForProfessional(professionalId).subscribe(items => {
      for (const item of items) {
        if (wanted.has(item.id)) {
          names.set(item.id, item.name);
        }
      }
    });
    return names;
  }

  /**
   * Validate a {@link TaskInput} against the documented bounds.
   * Returns an error message when invalid, or `null` when valid.
   */
  private validateInput(input: TaskInput): string | null {
    if (!input.professionalId) {
      return 'El id del profesional es obligatorio';
    }
    const nameLength = input.name?.length ?? 0;
    if (nameLength < 1 || nameLength > 100) {
      return 'El nombre debe tener entre 1 y 100 caracteres';
    }
    const descriptionLength = input.description?.length ?? 0;
    if (descriptionLength > 1000) {
      return 'La descripción no puede superar los 1000 caracteres';
    }
    const itemCount = input.itemIds?.length ?? 0;
    if (itemCount < 1 || itemCount > 100) {
      return 'La tarea debe tener entre 1 y 100 items';
    }
    return null;
  }
}
