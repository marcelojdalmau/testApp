import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';

import { MockTaskService } from './mock-task.service';
import {
  AssignmentMethod,
  AssignmentResult,
  ItemCompletion,
  Task,
  TaskInput,
} from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService item completion authorization.
 * Feature: management-restructure, Property 12: Completion rejected for a non-assigned athlete
 *
 * When `setItemCompletion` is called with an athleteId that does not match the
 * assignment's own `athleteId`, the call is rejected (the observable errors)
 * and NO ItemCompletion record is written: `getCompletions(assignmentId)`
 * remains empty and the store overall holds no completion for that assignment.
 *
 * Validates: Requirements 10.6
 */

describe('Feature: management-restructure, Property 12: Completion rejected for a non-assigned athlete', () => {
  /** A single-character alphanumeric segment used to build ids/names. */
  const idArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 8 })
    .filter((s) => s.trim().length > 0);

  /** Two DISTINCT athlete ids (assignedAthlete !== otherAthlete). */
  const distinctAthletesArb: fc.Arbitrary<{ assigned: string; other: string }> = fc
    .tuple(idArb, idArb)
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => ({ assigned: `ath-${a}`, other: `ath-${b}` }));

  /** An arbitrary item id to check off. */
  const itemIdArb: fc.Arbitrary<string> = idArb.map((s) => `item-${s}`);

  /** An assignment method for the (valid) initial assignment. */
  const methodArb: fc.Arbitrary<AssignmentMethod> = fc.constantFrom(
    AssignmentMethod.Direct,
    AssignmentMethod.Message,
    AssignmentMethod.Bulk,
  );

  /** Synchronously unwrap an of(...)-backed observable value. Throws on error. */
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

  /**
   * Create a task and assign it to `assignedAthlete`, returning the resulting
   * assignment id (created[0].id).
   */
  const setupAssignment = (
    service: MockTaskService,
    assignedAthlete: string,
    itemId: string,
    method: AssignmentMethod,
  ): string => {
    const input: TaskInput = {
      professionalId: 'pro-1',
      name: 'Task',
      description: '',
      itemIds: [itemId],
    };
    const task = sync<Task>(service.createTask(input));
    const result = sync<AssignmentResult>(
      service.assignTask(task.id, [assignedAthlete], method),
    );
    expect(result.created.length).toBe(1);
    return result.created[0].id;
  };

  it('rejects completed=true for a non-assigned athlete and records nothing', () => {
    fc.assert(
      fc.property(distinctAthletesArb, itemIdArb, methodArb, (athletes, itemId, method) => {
        const service = freshService();
        const assignmentId = setupAssignment(service, athletes.assigned, itemId, method);

        // The wrong athlete attempts to check off the item: it must reject.
        expect(() =>
          sync<void>(service.setItemCompletion(assignmentId, itemId, true, athletes.other)),
        ).toThrow();

        // Nothing was recorded for this assignment.
        const completions = sync<ItemCompletion[]>(service.getCompletions(assignmentId));
        expect(completions).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects completed=false for a non-assigned athlete and records nothing', () => {
    fc.assert(
      fc.property(distinctAthletesArb, itemIdArb, methodArb, (athletes, itemId, method) => {
        const service = freshService();
        const assignmentId = setupAssignment(service, athletes.assigned, itemId, method);

        // Clearing with the wrong athlete must also reject and write nothing.
        expect(() =>
          sync<void>(service.setItemCompletion(assignmentId, itemId, false, athletes.other)),
        ).toThrow();

        const completions = sync<ItemCompletion[]>(service.getCompletions(assignmentId));
        expect(completions).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
