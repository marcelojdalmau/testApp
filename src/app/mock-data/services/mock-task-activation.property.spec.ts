import * as fc from 'fast-check';

import { TestBed } from '@angular/core/testing';

import { MockTaskService } from './mock-task.service';
import { AssignmentMethod, AssignmentResult, TaskAssignment } from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService plan activation.
 * Feature: management-restructure, Property 10: At most one active plan per athlete
 *
 * For a single athlete with several TaskAssignments, over any arbitrary
 * sequence of activatePlan calls (choosing among the athlete's assignment ids,
 * with repeats allowed), the athlete has at most one active plan at every step.
 * Additionally, getActivePlan returns the last successfully activated plan, and
 * re-activating the already-active plan leaves the active state unchanged.
 *
 * Validates: Requirements 9.1, 9.3, 9.4, 9.5
 */

describe('Feature: management-restructure, Property 10: At most one active plan per athlete', () => {
  /** The single athlete under test across every run. */
  const ATHLETE_ID = 'ath-1';

  /**
   * A small pool of distinct task ids. Assigning the athlete to each of these
   * yields several distinct assignment ids for that athlete, giving the
   * activation sequence multiple plans to switch between.
   */
  const TASK_IDS: readonly string[] = ['task-a', 'task-b', 'task-c', 'task-d'];

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

  /** Count the athlete's assignments currently flagged active. */
  const activeCount = (service: MockTaskService): number =>
    sync<TaskAssignment[]>(service.getAssignmentsForAthlete(ATHLETE_ID)).filter(
      (assignment) => assignment.active,
    ).length;

  it('keeps at most one active plan after every activatePlan call over arbitrary sequences', () => {
    fc.assert(
      fc.property(
        // Number of distinct assignments to create for the athlete (1..4).
        fc.integer({ min: 1, max: TASK_IDS.length }),
        // A sequence of indices into the athlete's assignment id list. Each
        // index selects which plan to activate next; repeats re-activate.
        fc.array(fc.nat(), { minLength: 1, maxLength: 25 }),
        (assignmentCount, indexSeq) => {
          const service = freshService();

          // Create `assignmentCount` distinct assignments for the athlete, one
          // per distinct task id, so there are multiple distinct assignment ids.
          for (let i = 0; i < assignmentCount; i++) {
            sync<AssignmentResult>(
              service.assignTask(TASK_IDS[i], [ATHLETE_ID], AssignmentMethod.Direct),
            );
          }

          // Collect the athlete's assignment ids to drive the activation calls.
          const assignmentIds = sync<TaskAssignment[]>(
            service.getAssignmentsForAthlete(ATHLETE_ID),
          ).map((assignment) => assignment.id);

          // Empty case: assignmentIds should never be empty here, but guard so
          // the property degrades gracefully instead of throwing.
          if (assignmentIds.length === 0) {
            expect(activeCount(service)).toBe(0);
            expect(sync<TaskAssignment | null>(service.getActivePlan(ATHLETE_ID))).toBeNull();
            return;
          }

          // No plan is active before any activation.
          expect(activeCount(service)).toBe(0);
          expect(sync<TaskAssignment | null>(service.getActivePlan(ATHLETE_ID))).toBeNull();

          let lastActivatedId: string | null = null;

          for (const rawIndex of indexSeq) {
            const targetId = assignmentIds[rawIndex % assignmentIds.length];

            // Whether this call re-activates the already-active plan.
            const wasAlreadyActive = targetId === lastActivatedId;

            sync<void>(service.activatePlan(ATHLETE_ID, targetId));
            lastActivatedId = targetId;

            // Invariant: at most one active plan at every step.
            expect(activeCount(service)).toBeLessThanOrEqual(1);
            // After any activation there is exactly one active plan.
            expect(activeCount(service)).toBe(1);

            // getActivePlan returns the last-activated plan.
            const active = sync<TaskAssignment | null>(service.getActivePlan(ATHLETE_ID));
            expect(active).toBeTruthy();
            expect(active!.id).toBe(targetId);

            // Re-activating the already-active plan is a no-op that leaves the
            // active plan unchanged (still exactly one, still the same id).
            if (wasAlreadyActive) {
              expect(active!.id).toBe(lastActivatedId);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('never activates a plan that does not belong to the athlete and keeps the invariant', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 15 }), (indexSeq) => {
        const service = freshService();

        // The target athlete gets two assignments.
        sync<AssignmentResult>(
          service.assignTask(TASK_IDS[0], [ATHLETE_ID], AssignmentMethod.Direct),
        );
        sync<AssignmentResult>(
          service.assignTask(TASK_IDS[1], [ATHLETE_ID], AssignmentMethod.Direct),
        );

        // A different athlete gets their own assignment; activating it against
        // ATHLETE_ID must be rejected and must not affect ATHLETE_ID's state.
        sync<AssignmentResult>(
          service.assignTask(TASK_IDS[2], ['ath-other'], AssignmentMethod.Direct),
        );

        const ownIds = sync<TaskAssignment[]>(
          service.getAssignmentsForAthlete(ATHLETE_ID),
        ).map((assignment) => assignment.id);
        const foreignId = sync<TaskAssignment[]>(
          service.getAssignmentsForAthlete('ath-other'),
        )[0].id;

        // Interleave a foreign activation attempt among valid ones.
        for (const rawIndex of indexSeq) {
          const targetId = ownIds[rawIndex % ownIds.length];
          sync<void>(service.activatePlan(ATHLETE_ID, targetId));
          expect(activeCount(service)).toBe(1);

          // Attempting to activate the foreign assignment for ATHLETE_ID is
          // rejected; the athlete's active plan is unchanged.
          let rejected = false;
          try {
            sync<void>(service.activatePlan(ATHLETE_ID, foreignId));
          } catch {
            rejected = true;
          }
          expect(rejected).toBe(true);
          expect(activeCount(service)).toBe(1);
          const active = sync<TaskAssignment | null>(service.getActivePlan(ATHLETE_ID));
          expect(active!.id).toBe(targetId);
        }
      }),
      { numRuns: 100 },
    );
  });
});
