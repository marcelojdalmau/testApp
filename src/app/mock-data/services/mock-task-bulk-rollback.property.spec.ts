import * as fc from 'fast-check';
import { TestBed } from '@angular/core/testing';

import { MockTaskService } from './mock-task.service';
import { AssignmentMethod, TaskAssignment } from '../../core/models/management.model';

/**
 * Property-based tests for MockTaskService bulk assignment atomicity.
 * Feature: management-restructure, Property 9: Bulk assignment atomicity and rollback
 *
 * For any bulk assignment in which the creation of one or more TaskAssignment
 * records fails, the store ends with exactly the assignments it had before the
 * operation - none of the assignments attempted in that bulk call remain.
 *
 * The failure is injected by monkey-patching the private `createAssignmentRecord`
 * seam on the service instance so that it throws after N successful invocations
 * within the failing bulk call. Because `assignTask` stages every record before
 * committing (a single signal update applied only when all creations succeed),
 * a throw during staging must leave the store untouched.
 *
 * Validates: Requirements 6.8
 */

describe('Feature: management-restructure, Property 9: Bulk assignment atomicity and rollback', () => {
  /** A single athlete id reference (non-empty identifier string). */
  const athleteIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** A task id reference. */
  const taskIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /**
   * Synchronously unwrap an of(...)-backed observable value.
   * Throws if the observable errored (used to assert the bulk call rejects).
   */
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
   * Collect every TaskAssignment across the given athlete ids as a normalized,
   * order-independent snapshot suitable for equality comparison. Records are
   * keyed by their stable, business-meaningful fields (excluding the generated
   * `id`/`assignedAt`, which are irrelevant to "the store is unchanged").
   */
  const snapshotAssignments = (service: MockTaskService, athleteIds: string[]): string[] => {
    const rows: string[] = [];
    for (const athleteId of new Set(athleteIds)) {
      const assignments = sync<TaskAssignment[]>(service.getAssignmentsForAthlete(athleteId));
      for (const a of assignments) {
        rows.push(`${a.id}|${a.taskId}|${a.athleteId}|${a.method}|${a.active}|${a.assignedAt}`);
      }
    }
    return rows.sort();
  };

  it('leaves the store exactly at its pre-operation state when a bulk creation fails', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Athletes to pre-seed with successful assignments (may be empty).
          seedTaskId: taskIdArb,
          seedAthletes: fc.array(athleteIdArb, { minLength: 0, maxLength: 20 }),
          // The failing bulk call.
          bulkTaskId: taskIdArb,
          bulkAthletes: fc.array(athleteIdArb, { minLength: 2, maxLength: 20 }),
        }),
        ({ seedTaskId, seedAthletes, bulkTaskId, bulkAthletes }) => {
          // Fresh service per run so state does not leak between iterations.
          // A fresh TestBed provides the injection context MockTaskService needs
          // (it resolves MockItemService via inject() in a field initializer).
          TestBed.resetTestingModule();
          localStorage.clear();
          TestBed.configureTestingModule({ providers: [MockTaskService] });
          const service = TestBed.inject(MockTaskService);

          // Establish a (possibly non-empty) pre-operation state via a
          // successful bulk assignment of the seed athletes.
          if (seedAthletes.length > 0) {
            sync(service.assignTask(seedTaskId, seedAthletes, AssignmentMethod.Bulk));
          }

          // The union of every athlete id we could touch, for the snapshot.
          const allAthletes = [...seedAthletes, ...bulkAthletes];

          // Capture the pre-operation snapshot.
          const before = snapshotAssignments(service, allAthletes);

          // Determine how many *new* (not-yet-assigned) athletes the bulk call
          // would stage, so we can inject a failure partway through staging.
          // Only distinct ids not already assigned to bulkTaskId get staged,
          // mirroring the dedup logic inside assignTask.
          const seenPairs = new Set<string>();
          const seedAssignedToBulkTask = new Set(
            seedTaskId === bulkTaskId ? seedAthletes : [],
          );
          const stagedIds: string[] = [];
          for (const id of bulkAthletes) {
            if (seedAssignedToBulkTask.has(id) || seenPairs.has(id)) {
              continue;
            }
            seenPairs.add(id);
            stagedIds.push(id);
          }

          // Inject a failure: throw on the Kth staging call (1-based) where K is
          // within the number of records that would be staged, guaranteeing the
          // throw happens during this bulk operation. If nothing would be staged
          // (all duplicates), force a throw on the first call so we still test a
          // failure path.
          const failOnCall = stagedIds.length > 0
            ? Math.min(stagedIds.length, 2)
            : 1;
          let callCount = 0;
          (service as unknown as {
            createAssignmentRecord: (
              taskId: string,
              athleteId: string,
              method: AssignmentMethod,
            ) => TaskAssignment;
          }).createAssignmentRecord = (
            taskId: string,
            athleteId: string,
            method: AssignmentMethod,
          ): TaskAssignment => {
            callCount += 1;
            if (callCount >= failOnCall) {
              throw new Error('Injected creation failure');
            }
            return {
              id: `injected-${callCount}`,
              taskId,
              athleteId,
              assignedAt: new Date().toISOString(),
              method,
              active: false,
            };
          };

          // The bulk call must reject (sync throws on observable error). If the
          // call would stage no records (all duplicates -> no createAssignmentRecord
          // invocation), the operation succeeds without touching the store, which
          // still satisfies "store unchanged".
          let threw = false;
          try {
            sync(service.assignTask(bulkTaskId, bulkAthletes, AssignmentMethod.Bulk));
          } catch {
            threw = true;
          }

          // When at least one record would be staged, the injected failure must
          // have fired and the call must have rejected.
          if (stagedIds.length > 0) {
            expect(threw).toBe(true);
          }

          // The store must equal its pre-operation state exactly: no partial or
          // staged assignments from the failing bulk call remain.
          const after = snapshotAssignments(service, allAthletes);
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});
