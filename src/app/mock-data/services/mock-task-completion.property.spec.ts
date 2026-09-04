import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';

import { MockTaskService } from './mock-task.service';
import {
  AssignmentMethod,
  AssignmentProgress,
  AssignmentResult,
  ItemProgress,
  Task,
  TaskInput,
} from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService item completion.
 * Feature: management-restructure, Property 11: Item completion bidirectional round-trip
 *
 * For any assigned Task and any Item within it, checking the Item off and then
 * clearing it returns the assignment's progress to exactly the state it had
 * before the round-trip. Concretely: from the initial (not-completed) state,
 * setItemCompletion(..., true) makes getProgress report that Item as
 * completed === true, and a subsequent setItemCompletion(..., false) makes
 * getProgress report it as completed === false with the overall items array
 * equal to the pre-round-trip snapshot.
 *
 * Note on athlete resolution: getProgress reports items as completed only when
 * the assignment's athlete resolves against MOCK_ATHLETES (athleteName !==
 * null). To make completions observable we assign to a real athlete id from
 * MOCK_ATHLETES; otherwise every item is reported not-completed regardless of
 * recorded completions.
 *
 * Validates: Requirements 7.2, 7.3, 10.1, 10.2, 10.3, 10.4
 */

describe('Feature: management-restructure, Property 11: Item completion bidirectional round-trip', () => {
  /** A real athlete id present in MOCK_ATHLETES so completions are observable. */
  const realAthleteIdArb: fc.Arbitrary<string> = fc.constantFrom(
    'ath_001',
    'ath_002',
    'ath_003',
    'ath_004',
    'ath_005',
    'ath_006',
    'ath_007',
    'ath_008',
  );

  /** Assignment method; Direct and Bulk are both valid for a single athlete. */
  const methodArb: fc.Arbitrary<AssignmentMethod> = fc.constantFrom(
    AssignmentMethod.Direct,
    AssignmentMethod.Bulk,
  );

  /** A valid Task name (1..100 chars). */
  const nameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 });

  /** A valid Task description (0..1000 chars). */
  const descriptionArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 1000 });

  /**
   * A valid, ordered, duplicate-free list of itemIds (length 1..100).
   * fast-check's uniqueArray keeps distinct references so a chosen itemId maps
   * to a single ItemProgress entry in getProgress.
   */
  const itemIdsArb: fc.Arbitrary<string[]> = fc.uniqueArray(
    fc.string({ minLength: 1, maxLength: 40 }),
    { minLength: 1, maxLength: 100 },
  );

  /** Synchronously unwrap an of(...)-backed observable value. */
  const sync = <T>(obs: {
    subscribe: (o: { next: (v: T) => void; error: (e: unknown) => void }) => void;
  }): T => {
    let value: T;
    let captured = false;
    let error: unknown;
    let hadError = false;
    obs.subscribe({
      next: (v) => {
        value = v;
        captured = true;
      },
      error: (e) => {
        error = e;
        hadError = true;
      },
    });
    if (hadError) {
      throw error;
    }
    if (!captured) {
      throw new Error('Observable did not emit synchronously');
    }
    return value!;
  };

  /**
   * Create a fresh MockTaskService within an Angular injection context.
   * The service uses `inject(MockItemService)` in a field initializer, so it
   * cannot be constructed with `new` outside an injection context.
   */
  const freshService = (): MockTaskService => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({});
    return TestBed.inject(MockTaskService);
  };

  /** Look up the ItemProgress entry for a given itemId. */
  const findItem = (progress: AssignmentProgress, itemId: string): ItemProgress | undefined =>
    progress.items.find((item) => item.itemId === itemId);

  it('check-off then clear returns getProgress to its prior state', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalId: fc.string({ minLength: 1, maxLength: 40 }),
          name: nameArb,
          description: descriptionArb,
          itemIds: itemIdsArb,
        }),
        realAthleteIdArb,
        methodArb,
        // Fraction (0..1) used to select an arbitrary item index deterministically.
        fc.double({ min: 0, max: 1, noNaN: true }),
        (taskInput: TaskInput, athleteId, method, pick) => {
          const service = freshService();

          // Create the Task, then assign it to a real athlete.
          const task = sync<Task>(service.createTask(taskInput));
          const assignResult = sync<AssignmentResult>(
            service.assignTask(task.id, [athleteId], method),
          );
          expect(assignResult.created.length).toBe(1);
          const assignmentId = assignResult.created[0].id;

          // Pick an arbitrary itemId from the task's items.
          const index = Math.min(
            task.itemIds.length - 1,
            Math.floor(pick * task.itemIds.length),
          );
          const itemId = task.itemIds[index];

          // progress0: initial state; the picked item starts not-completed.
          const progress0 = sync<AssignmentProgress>(service.getProgress(assignmentId));
          expect(findItem(progress0, itemId)?.completed).toBe(false);

          // Check the item off; getProgress must report it completed.
          sync<void>(service.setItemCompletion(assignmentId, itemId, true, athleteId));
          const progressChecked = sync<AssignmentProgress>(service.getProgress(assignmentId));
          expect(findItem(progressChecked, itemId)?.completed).toBe(true);

          // Clear the item; getProgress must report it not-completed again.
          sync<void>(service.setItemCompletion(assignmentId, itemId, false, athleteId));
          const progressCleared = sync<AssignmentProgress>(service.getProgress(assignmentId));
          expect(findItem(progressCleared, itemId)?.completed).toBe(false);

          // Round-trip: the overall items array returns to its prior state.
          expect(progressCleared.items).toEqual(progress0.items);
        },
      ),
      { numRuns: 100 },
    );
  });
});
