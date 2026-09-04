import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { AssignmentProgressComponent } from './assignment-progress.component';
import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { AssignmentProgress } from '../../core/models/management.model';

/**
 * Example/edge tests for the assignment progress view (AssignmentProgressComponent).
 *
 * Validates:
 * - Requirement 7.1: WHERE a Professional has created a Task_Assignment, THE
 *   Management_Area SHALL display the assigned Athlete's identifying name.
 * - Requirement 7.4: IF a Task_Assignment has no assigned Athlete, THEN THE
 *   Management_Area SHALL display an indication that no Athlete is assigned and
 *   SHALL display every Item with completion state "not completed".
 * - Requirement 7.5: IF the completion progress cannot be retrieved, THEN THE
 *   Management_Area SHALL display an error indication that progress is
 *   unavailable and SHALL NOT display any Item completion state.
 */
describe('AssignmentProgressComponent example tests', () => {
  let fixture: ComponentFixture<AssignmentProgressComponent>;
  let component: AssignmentProgressComponent;
  let taskService: jasmine.SpyObj<MockTaskService>;

  const ASSIGNMENT_ID = 'assignment-1';

  /** Configure the component with the given assignmentId and run change detection. */
  function createWith(assignmentId: string): void {
    fixture = TestBed.createComponent(AssignmentProgressComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('assignmentId', assignmentId);
    fixture.detectChanges(); // triggers ngOnInit -> refresh()
  }

  beforeEach(() => {
    taskService = jasmine.createSpyObj<MockTaskService>('MockTaskService', ['getProgress']);

    TestBed.configureTestingModule({
      imports: [AssignmentProgressComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MockTaskService, useValue: taskService },
      ],
    });
  });

  // --- Requirement 7.1: athlete name is shown ------------------------------

  it("displays the assigned athlete's identifying name (7.1)", () => {
    const progress: AssignmentProgress = {
      assignmentId: ASSIGNMENT_ID,
      athleteId: 'ath-1',
      athleteName: 'Lucía Fernández',
      items: [
        { itemId: 'item-1', itemName: 'Calentamiento', completed: true },
        { itemId: 'item-2', itemName: 'Series', completed: false },
      ],
    };
    taskService.getProgress.and.returnValue(of(progress));

    createWith(ASSIGNMENT_ID);

    expect(taskService.getProgress).toHaveBeenCalledOnceWith(ASSIGNMENT_ID);
    expect(component.athleteName()).toBe('Lucía Fernández');
    expect(component.hasNoAthlete()).toBeFalse();
    expect(component.unavailable()).toBeFalse();

    const nameEl: HTMLElement | null =
      fixture.nativeElement.querySelector('.athlete-name-text');
    expect(nameEl).not.toBeNull();
    expect(nameEl?.textContent?.trim()).toBe('Lucía Fernández');

    // Item states are rendered.
    const rows: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.item-row');
    expect(rows.length).toBe(2);
  });

  // --- Requirement 7.4: no-athlete assignment ------------------------------

  it('shows the no-athlete indication and renders all items not-completed when no athlete is assigned (7.4)', () => {
    // Per the service contract, when no athlete resolves athleteName is null and
    // every item's completed flag is false.
    const progress: AssignmentProgress = {
      assignmentId: ASSIGNMENT_ID,
      athleteId: 'ath-unknown',
      athleteName: null,
      items: [
        { itemId: 'item-1', itemName: 'Calentamiento', completed: false },
        { itemId: 'item-2', itemName: 'Series', completed: false },
        { itemId: 'item-3', itemName: 'Enfriamiento', completed: false },
      ],
    };
    taskService.getProgress.and.returnValue(of(progress));

    createWith(ASSIGNMENT_ID);

    expect(component.hasNoAthlete()).toBeTrue();
    expect(component.unavailable()).toBeFalse();

    // The no-athlete indication is shown.
    const noAthlete: HTMLElement | null =
      fixture.nativeElement.querySelector('.no-athlete');
    expect(noAthlete).not.toBeNull();
    expect(noAthlete?.getAttribute('role')).toBe('status');

    // Every item is rendered and none is marked completed.
    expect(component.items().length).toBe(3);
    expect(component.items().every(item => !item.completed)).toBeTrue();

    const completedRows: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.item-row.item-completed');
    expect(completedRows.length).toBe(0);
  });

  // --- Requirement 7.5: progress unavailable -------------------------------

  it('shows the "progress unavailable" state and renders no item states when getProgress fails (7.5)', () => {
    taskService.getProgress.and.returnValue(
      throwError(() => new Error('Assignment not found')),
    );

    createWith(ASSIGNMENT_ID);

    expect(component.unavailable()).toBeTrue();
    expect(component.progress()).toBeNull();

    // No item completion state is rendered for an errored assignment.
    expect(component.items().length).toBe(0);
    const rows: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.item-row');
    expect(rows.length).toBe(0);

    // The unavailable error indication is shown as an alert.
    const errorEl: HTMLElement | null =
      fixture.nativeElement.querySelector('.progress-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute('role')).toBe('alert');

    // No athlete-name or no-athlete indications are shown while unavailable.
    expect(fixture.nativeElement.querySelector('.athlete-name')).toBeNull();
    expect(fixture.nativeElement.querySelector('.no-athlete')).toBeNull();
  });

  it('reflects updated completions on refresh (7.3)', () => {
    const before: AssignmentProgress = {
      assignmentId: ASSIGNMENT_ID,
      athleteId: 'ath-1',
      athleteName: 'Lucía Fernández',
      items: [{ itemId: 'item-1', itemName: 'Calentamiento', completed: false }],
    };
    const after: AssignmentProgress = {
      ...before,
      items: [{ itemId: 'item-1', itemName: 'Calentamiento', completed: true }],
    };
    taskService.getProgress.and.returnValues(of(before), of(after));

    createWith(ASSIGNMENT_ID);
    expect(component.items()[0].completed).toBeFalse();

    component.refresh();
    fixture.detectChanges();

    expect(taskService.getProgress).toHaveBeenCalledTimes(2);
    expect(component.items()[0].completed).toBeTrue();
  });
});
