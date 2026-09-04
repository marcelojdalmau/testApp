import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { TaskAssignmentComponent } from './task-assignment.component';
import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { CurrentUserService } from '../../core/services/current-user.service';
import {
  AssignmentMethod,
  AssignmentResult,
  Task,
} from '../../core/models/management.model';

/**
 * Example/edge tests for the Task assignment UI (TaskAssignmentComponent).
 *
 * Validates:
 * - Requirement 6.4: THE Management_Area SHALL present the direct, message-based,
 *   and bulk assignment methods as available options.
 * - Requirement 6.5: IF a Professional attempts to assign a Task without selecting
 *   at least one Athlete, THEN THE Management_Area SHALL reject the assignment,
 *   retain the current selection state, and display a validation message within 2s.
 * - Requirement 6.6: IF a Professional attempts a bulk assignment to more than 500
 *   Athletes, THEN THE Management_Area SHALL reject the assignment, retain the
 *   selection, and display the max-athletes message. A selection of exactly 500 is
 *   accepted.
 */
describe('TaskAssignmentComponent example tests', () => {
  let fixture: ComponentFixture<TaskAssignmentComponent>;
  let component: TaskAssignmentComponent;
  let taskService: jasmine.SpyObj<MockTaskService>;

  const PROFESSIONAL_ID = 'pro-1';
  const TASK_ID = 'task-1';

  const OWNED_TASK: Task = {
    id: TASK_ID,
    professionalId: PROFESSIONAL_ID,
    name: 'Rutina de fuerza',
    description: '',
    itemIds: ['item-1'],
    createdAt: new Date().toISOString(),
  };

  /** Stub CurrentUserService returning a fixed professional id. */
  const currentUserStub: Partial<CurrentUserService> = {
    userId: (() => PROFESSIONAL_ID) as unknown as CurrentUserService['userId'],
  };

  /** Build a synthetic list of unique athlete ids of the requested size. */
  function athleteIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `ath-${i}`);
  }

  beforeEach(() => {
    taskService = jasmine.createSpyObj<MockTaskService>('MockTaskService', [
      'getTasksForProfessional',
      'assignTask',
      'seedMockProgress',
    ]);
    taskService.getTasksForProfessional.and.returnValue(of([OWNED_TASK]));
    // The component derives its task list reactively from the store's tasks$
    // signal, so expose the owned task through a read-only signal.
    (taskService as unknown as { tasks$: unknown }).tasks$ = signal([OWNED_TASK]).asReadonly();
    // Progress seeding after a successful assignment is a no-op in tests.
    taskService.seedMockProgress.and.returnValue(of(undefined));
    // Default: assignTask succeeds, creating one assignment per athlete requested.
    taskService.assignTask.and.callFake(
      (taskId: string, ids: string[]): ReturnType<MockTaskService['assignTask']> => {
        const result: AssignmentResult = {
          created: ids.map((athleteId, index) => ({
            id: `assignment-${index}`,
            taskId,
            athleteId,
            assignedAt: new Date().toISOString(),
            method: AssignmentMethod.Bulk,
            active: false,
          })),
          skipped: [],
        };
        return of(result);
      },
    );

    TestBed.configureTestingModule({
      imports: [TaskAssignmentComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MockTaskService, useValue: taskService },
        { provide: CurrentUserService, useValue: currentUserStub },
      ],
    });

    fixture = TestBed.createComponent(TaskAssignmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // --- Requirement 6.4: all three assignment methods are offered -----------

  it('offers direct, message-based, and bulk assignment methods (6.4)', () => {
    const toggles: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('mat-button-toggle');
    const labels = Array.from(toggles).map(t => t.textContent?.trim().toLowerCase() ?? '');

    // Exactly the three documented methods are presented as selectable options.
    expect(toggles.length).toBe(3);
    expect(labels.some(l => l.includes('directa'))).toBeTrue();
    expect(labels.some(l => l.includes('mensaje'))).toBeTrue();
    expect(labels.some(l => l.includes('masa'))).toBeTrue();

    // The enum backing the toggles exposes all three method values.
    expect(component.AssignmentMethod.Direct).toBe(AssignmentMethod.Direct);
    expect(component.AssignmentMethod.Message).toBe(AssignmentMethod.Message);
    expect(component.AssignmentMethod.Bulk).toBe(AssignmentMethod.Bulk);
  });

  // --- Requirement 6.5: empty selection is rejected, selection retained ----

  it('rejects an empty selection with a validation message, retaining the selection (6.5)', () => {
    component.onTaskChange(TASK_ID);
    fixture.detectChanges();

    // No athletes are selected.
    expect(component.selectedAthleteIds().length).toBe(0);

    const start = Date.now();
    component.assign();
    const elapsed = Date.now() - start;
    fixture.detectChanges();

    // A validation message is shown effectively immediately (well within 2s).
    expect(component.validationMessage()).toBe('Seleccioná al menos un atleta');
    expect(elapsed).toBeLessThan(2000);

    // The assignment was rejected: the store was never asked to assign.
    expect(taskService.assignTask).not.toHaveBeenCalled();

    // The (empty) selection state is retained.
    expect(component.selectedAthleteIds().length).toBe(0);

    // The message is rendered as an alert in the template.
    const alert: HTMLElement | null =
      fixture.nativeElement.querySelector('p.validation-error');
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent?.trim()).toBe('Seleccioná al menos un atleta');
  });

  // --- Requirement 6.6: bulk boundary at 500 -------------------------------

  it('accepts a bulk assignment of exactly 500 athletes (6.6)', () => {
    const ids = athleteIds(500);
    component.onTaskChange(TASK_ID);
    component.onMethodChange(AssignmentMethod.Bulk);
    component.selectedAthleteIds.set(ids);
    fixture.detectChanges();

    component.assign();
    fixture.detectChanges();

    // 500 is within bounds: no validation message and the store was invoked.
    expect(component.validationMessage()).toBeNull();
    expect(taskService.assignTask).toHaveBeenCalledOnceWith(
      TASK_ID,
      ids,
      AssignmentMethod.Bulk,
    );
    expect(component.successMessage()).toContain('500 asignación(es) creada(s)');
  });

  it('rejects a bulk assignment of 501 athletes with the max-athletes message, retaining the selection (6.6)', () => {
    const ids = athleteIds(501);
    component.onTaskChange(TASK_ID);
    component.onMethodChange(AssignmentMethod.Bulk);
    component.selectedAthleteIds.set(ids);
    fixture.detectChanges();

    const start = Date.now();
    component.assign();
    const elapsed = Date.now() - start;
    fixture.detectChanges();

    // 501 exceeds the bulk max: rejected with the max-athletes message within 2s.
    expect(component.validationMessage()).toBe(
      `Una asignación en masa permite como máximo ${component.bulkMax} atletas`,
    );
    expect(elapsed).toBeLessThan(2000);

    // The store was never asked to assign.
    expect(taskService.assignTask).not.toHaveBeenCalled();

    // The full selection is retained.
    expect(component.selectedAthleteIds().length).toBe(501);

    // The message is rendered as an alert in the template.
    const alert: HTMLElement | null =
      fixture.nativeElement.querySelector('p.validation-error');
    expect(alert).not.toBeNull();
    expect(alert?.textContent?.trim()).toBe(
      `Una asignación en masa permite como máximo ${component.bulkMax} atletas`,
    );
  });
});
