import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';

import { MockTaskService } from './mock-task.service';
import { Task, TaskInput } from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService.
 * Feature: management-restructure, Property 5: Task persistence preserves ordered items
 *
 * For any valid TaskInput (name 1-100, description 0-1000, 1-100 item ids),
 * creating or editing the Task and reading it back yields name, description,
 * and an itemIds sequence identical in contents and order to the input; and
 * appending a selected Item to a task-in-progress places it at the end while
 * leaving the existing prefix unchanged.
 *
 * Validates: Requirements 5.2, 5.5, 5.6, 5.7
 */

describe('Feature: management-restructure, Property 5: Task persistence preserves ordered items', () => {
  /** A valid Task name: length 1..100. */
  const nameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 });

  /** A valid Task description: length 0..1000. */
  const descriptionArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 1000 });

  /** A single Item id reference (non-empty identifier string). */
  const itemIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** A valid, ordered itemIds list: length 1..100 (duplicates allowed; order matters). */
  const itemIdsArb: fc.Arbitrary<string[]> = fc.array(itemIdArb, { minLength: 1, maxLength: 100 });

  /** A professional id: a non-empty identifier string. */
  const professionalIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** A valid TaskInput for a given professionalId. */
  const taskInputForProfessional = (professionalId: string): fc.Arbitrary<TaskInput> =>
    fc.record({
      professionalId: fc.constant(professionalId),
      name: nameArb,
      description: descriptionArb,
      itemIds: itemIdsArb,
    });

  /** A fully arbitrary valid TaskInput (any professional). */
  const taskInputArb: fc.Arbitrary<TaskInput> = professionalIdArb.chain(taskInputForProfessional);

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

  it('creates a Task and reads it back with equal name, description, and ordered itemIds', () => {
    fc.assert(
      fc.property(taskInputArb, (input) => {
        // Fresh service per run so state does not leak between iterations.
        const service = freshService();

        const created = sync<Task>(service.createTask(input));

        const readBack = sync<Task[]>(service.getTasksForProfessional(input.professionalId));
        const record = readBack.find((task) => task.id === created.id);

        expect(record).toBeTruthy();
        expect(record!.name).toBe(input.name);
        expect(record!.description).toBe(input.description);
        // itemIds identical in contents AND order.
        expect(record!.itemIds).toEqual(input.itemIds);
      }),
      { numRuns: 100 },
    );
  });

  it('reflects edits to an owned Task on read-back, preserving ordered itemIds', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain((pid) =>
          fc.tuple(taskInputForProfessional(pid), taskInputForProfessional(pid)),
        ),
        ([original, updatedInput]) => {
          const service = freshService();

          const created = sync<Task>(service.createTask(original));
          sync<Task>(service.updateTask(created.id, updatedInput));

          const readBack = sync<Task[]>(service.getTasksForProfessional(original.professionalId));
          const record = readBack.find((task) => task.id === created.id);

          expect(record).toBeTruthy();
          expect(record!.name).toBe(updatedInput.name);
          expect(record!.description).toBe(updatedInput.description);
          expect(record!.itemIds).toEqual(updatedInput.itemIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('appends an item to the end of the ordered list, leaving the existing prefix unchanged', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain((pid) =>
          fc.record({
            professionalId: fc.constant(pid),
            name: nameArb,
            description: descriptionArb,
            // Prefix length 1..99 so there is room to append and stay within 1..100.
            prefix: fc.array(itemIdArb, { minLength: 1, maxLength: 99 }),
            appended: itemIdArb,
          }),
        ),
        ({ professionalId, name, description, prefix, appended }) => {
          const service = freshService();

          // Build the task-in-progress with the prefix only.
          const created = sync<Task>(
            service.createTask({ professionalId, name, description, itemIds: prefix }),
          );

          // Appending an item models selecting a suggested Item (Requirement 5.5):
          // it lands at the end while leaving the existing prefix unchanged.
          const appendedList = [...prefix, appended];
          sync<Task>(
            service.updateTask(created.id, { professionalId, name, description, itemIds: appendedList }),
          );

          const readBack = sync<Task[]>(service.getTasksForProfessional(professionalId));
          const record = readBack.find((task) => task.id === created.id);

          expect(record).toBeTruthy();
          // Full list matches the appended list exactly.
          expect(record!.itemIds).toEqual(appendedList);
          // The prefix (all but the last element) is unchanged.
          expect(record!.itemIds.slice(0, prefix.length)).toEqual(prefix);
          // The appended item lands at the end.
          expect(record!.itemIds[record!.itemIds.length - 1]).toBe(appended);
        },
      ),
      { numRuns: 100 },
    );
  });
});
