import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';

import { MockTaskService } from './mock-task.service';
import { AssignmentMethod, AssignmentResult, TaskAssignment } from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService assignment de-duplication.
 * Feature: management-restructure, Property 8: No duplicate TaskAssignment for the same task and athlete
 *
 * For any sequence of assignment operations, the resulting set of
 * TaskAssignment records contains no two records sharing the same
 * (taskId, athleteId) pair; re-assigning an existing pair retains the existing
 * assignment unchanged (the athlete id is reported in AssignmentResult.skipped
 * and no new record is created).
 *
 * Validates: Requirements 6.7
 */

describe('Feature: management-restructure, Property 8: No duplicate TaskAssignment for the same task and athlete', () => {
  /** Small pool of task ids so operations overlap and dedup is exercised. */
  const taskIdArb: fc.Arbitrary<string> = fc.constantFrom('task-a', 'task-b', 'task-c');

  /** Small pool of athlete ids so operations overlap across ops. */
  const athleteIdArb: fc.Arbitrary<string> = fc.constantFrom(
    'ath-1',
    'ath-2',
    'ath-3',
    'ath-4',
    'ath-5',
  );

  /** An assignment method. Bulk stays valid since athlete lists are 1..5. */
  const methodArb: fc.Arbitrary<AssignmentMethod> = fc.constantFrom(
    AssignmentMethod.Direct,
    AssignmentMethod.Message,
    AssignmentMethod.Bulk,
  );

  /** A single assignment operation drawn from the small pools. */
  interface AssignOp {
    taskId: string;
    athleteIds: string[];
    method: AssignmentMethod;
  }

  const assignOpArb: fc.Arbitrary<AssignOp> = fc.record({
    taskId: taskIdArb,
    // 1..5 athletes, duplicates allowed (dedup within a request is also exercised).
    athleteIds: fc.array(athleteIdArb, { minLength: 1, maxLength: 5 }),
    method: methodArb,
  });

  /** An arbitrary sequence of assignment operations. */
  const opSequenceArb: fc.Arbitrary<AssignOp[]> = fc.array(assignOpArb, {
    minLength: 1,
    maxLength: 20,
  });

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

  const pairKey = (assignment: TaskAssignment): string =>
    `${assignment.taskId}::${assignment.athleteId}`;

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

  it('never stores two records sharing the same (taskId, athleteId) pair over arbitrary sequences', () => {
    fc.assert(
      fc.property(opSequenceArb, (ops) => {
        // Fresh service per run so state does not leak between iterations.
        const service = freshService();

        // Distinct athlete ids used across the whole sequence, for querying back.
        const athletesUsed = new Set<string>();
        for (const op of ops) {
          for (const athleteId of op.athleteIds) {
            athletesUsed.add(athleteId);
          }
          sync<AssignmentResult>(service.assignTask(op.taskId, op.athleteIds, op.method));
        }

        // Gather ALL assignment records by unioning per-athlete queries.
        const all: TaskAssignment[] = [];
        for (const athleteId of athletesUsed) {
          all.push(...sync<TaskAssignment[]>(service.getAssignmentsForAthlete(athleteId)));
        }

        // No two records share the same (taskId, athleteId) pair.
        const keys = all.map(pairKey);
        const unique = new Set(keys);
        expect(unique.size).toBe(keys.length);
      }),
      { numRuns: 100 },
    );
  });

  it('reports an already-assigned pair in skipped and creates no new record when re-assigned', () => {
    fc.assert(
      fc.property(taskIdArb, athleteIdArb, methodArb, methodArb, (taskId, athleteId, first, second) => {
        const service = freshService();

        // First assignment creates exactly one record for the pair.
        const firstResult = sync<AssignmentResult>(
          service.assignTask(taskId, [athleteId], first),
        );
        expect(firstResult.created.length).toBe(1);
        expect(firstResult.skipped).toEqual([]);

        const afterFirst = sync<TaskAssignment[]>(service.getAssignmentsForAthlete(athleteId));
        const recordAfterFirst = afterFirst.find(
          (a) => a.taskId === taskId && a.athleteId === athleteId,
        );
        expect(recordAfterFirst).toBeTruthy();

        // Re-assigning the same (taskId, athleteId) pair skips it, creates nothing.
        const secondResult = sync<AssignmentResult>(
          service.assignTask(taskId, [athleteId], second),
        );
        expect(secondResult.created.length).toBe(0);
        expect(secondResult.skipped).toEqual([athleteId]);

        // The existing assignment is retained unchanged.
        const afterSecond = sync<TaskAssignment[]>(service.getAssignmentsForAthlete(athleteId));
        const matching = afterSecond.filter(
          (a) => a.taskId === taskId && a.athleteId === athleteId,
        );
        expect(matching.length).toBe(1);
        expect(matching[0]).toEqual(recordAfterFirst!);
      }),
      { numRuns: 100 },
    );
  });
});
