import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';

import { MockTaskService } from './mock-task.service';
import { AssignmentMethod, AssignmentResult, TaskAssignment } from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService assignment.
 * Feature: management-restructure, Property 7: Assignment creates exactly one TaskAssignment per new athlete
 *
 * For any task and any set of athlete ids, assigning through any method
 * (direct, message, or bulk) creates exactly one TaskAssignment for each
 * athlete that does not already have an assignment for that task, and the
 * created assignment carries the correct taskId, athleteId, and method.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

describe('Feature: management-restructure, Property 7: Assignment creates exactly one TaskAssignment per new athlete', () => {
  /** A task id: a non-empty identifier string. */
  const taskIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** A single athlete id reference (non-empty identifier string). */
  const athleteIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** The assignment method under test. */
  const methodArb: fc.Arbitrary<AssignmentMethod> = fc.constantFrom(
    AssignmentMethod.Direct,
    AssignmentMethod.Message,
    AssignmentMethod.Bulk,
  );

  /**
   * A method + athleteIds pair. Bulk enforces a 1..500 bound in the service;
   * we keep sizes small (1..50) for test speed while remaining valid for all
   * three methods.
   */
  const methodAndAthletesArb: fc.Arbitrary<{ method: AssignmentMethod; athleteIds: string[] }> =
    methodArb.chain((method) =>
      fc
        .array(athleteIdArb, { minLength: 1, maxLength: 50 })
        .map((athleteIds) => ({ method, athleteIds })),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  /**
   * Construct a fresh MockTaskService for a single run. The service uses
   * `inject(MockItemService)` in a field initializer, so it must be created
   * within an injection context. A fresh instance ensures state does not leak
   * between iterations.
   */
  const freshService = (): MockTaskService => {
    localStorage.clear();
    return runInInjectionContext(TestBed.inject(Injector), () => new MockTaskService());
  };

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

  it('creates exactly one correct TaskAssignment per distinct new athlete', () => {
    fc.assert(
      fc.property(taskIdArb, methodAndAthletesArb, (taskId, { method, athleteIds }) => {
        // Fresh service per run so state does not leak between iterations.
        const service = freshService();

        // On a fresh store, no athlete has an existing assignment for this task,
        // so every distinct athlete id is a "new" athlete.
        const distinctNewAthletes = new Set(athleteIds);

        const result = sync<AssignmentResult>(service.assignTask(taskId, athleteIds, method));

        // Exactly one created assignment per distinct new athlete.
        expect(result.created.length).toBe(distinctNewAthletes.size);

        // Each created assignment carries the correct taskId, an athleteId from
        // the requested set, and the requested method.
        for (const assignment of result.created) {
          expect(assignment.taskId).toBe(taskId);
          expect(distinctNewAthletes.has(assignment.athleteId)).toBe(true);
          expect(assignment.method).toBe(method);
        }

        // No athlete appears twice in the created set.
        const createdAthleteIds = result.created.map((assignment) => assignment.athleteId);
        expect(new Set(createdAthleteIds).size).toBe(createdAthleteIds.length);

        // The set of created athletes equals the distinct requested athletes.
        expect(new Set(createdAthleteIds)).toEqual(distinctNewAthletes);

        // Repeats within the same request are reported as skipped, never created.
        expect(result.skipped.length).toBe(athleteIds.length - distinctNewAthletes.size);

        // getAssignmentsForAthlete returns the created assignment for each new athlete.
        for (const athleteId of distinctNewAthletes) {
          const forAthlete = sync<TaskAssignment[]>(service.getAssignmentsForAthlete(athleteId));
          const match = forAthlete.find(
            (assignment) => assignment.taskId === taskId && assignment.athleteId === athleteId,
          );
          expect(match).toBeTruthy();
          expect(match!.method).toBe(method);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('creates one assignment only for athletes not already assigned to the task', () => {
    fc.assert(
      fc.property(
        taskIdArb,
        methodArb,
        fc.array(athleteIdArb, { minLength: 1, maxLength: 25 }),
        fc.array(athleteIdArb, { minLength: 1, maxLength: 25 }),
        (taskId, method, firstAthletes, secondAthletes) => {
          const service = freshService();

          // First assignment pass establishes existing (taskId, athleteId) pairs.
          sync<AssignmentResult>(service.assignTask(taskId, firstAthletes, method));
          const alreadyAssigned = new Set(firstAthletes);

          // Second pass: only distinct athletes NOT already assigned are "new".
          const distinctSecond = new Set(secondAthletes);
          const expectedNew = new Set(
            [...distinctSecond].filter((id) => !alreadyAssigned.has(id)),
          );

          const result = sync<AssignmentResult>(
            service.assignTask(taskId, secondAthletes, method),
          );

          // Exactly one created assignment per athlete without a prior assignment.
          expect(result.created.length).toBe(expectedNew.size);

          const createdAthleteIds = result.created.map((assignment) => assignment.athleteId);
          expect(new Set(createdAthleteIds)).toEqual(expectedNew);

          for (const assignment of result.created) {
            expect(assignment.taskId).toBe(taskId);
            expect(assignment.method).toBe(method);
            expect(alreadyAssigned.has(assignment.athleteId)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
