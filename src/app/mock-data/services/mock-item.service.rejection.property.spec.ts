import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';

import { MockItemService } from './mock-item.service';
import { Item, ItemInput } from '../../core/models/management.model';

/**
 * Property-based tests for MockItemService rejection behavior.
 * Feature: management-restructure, Property 4: Invalid or absent Item operations are rejected without side effects
 *
 * For any ItemInput that violates a bound (name empty or length > 100,
 * description length > 500, or duration outside 1-1440), and for any Item id
 * that does not exist in the acting professional's list, the corresponding
 * create/update/delete operation is rejected and the store's set of Items
 * remains unchanged.
 *
 * Validates: Requirements 4.6, 4.7, 5.8, 5.9, 5.10
 */
describe('Feature: management-restructure, Property 4: Invalid or absent Item operations are rejected without side effects', () => {
  /** Create a fresh, isolated service per property run so state never leaks. */
  function freshService(): MockItemService {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockItemService] });
    return TestBed.inject(MockItemService);
  }

  /** A valid professional id (non-empty). */
  const professionalIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** A valid ItemInput used to pre-seed the store. */
  function validInputArb(professionalId: string): fc.Arbitrary<ItemInput> {
    return fc.record({
      professionalId: fc.constant(professionalId),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.string({ minLength: 0, maxLength: 500 }),
      durationMinutes: fc.integer({ min: 1, max: 1440 }),
    });
  }

  /** An ItemInput whose name is empty (violates name >= 1). */
  const emptyNameArb = (pid: string): fc.Arbitrary<ItemInput> =>
    fc.record({
      professionalId: fc.constant(pid),
      name: fc.constant(''),
      description: fc.string({ minLength: 0, maxLength: 500 }),
      durationMinutes: fc.integer({ min: 1, max: 1440 }),
    });

  /** An ItemInput whose name exceeds 100 characters. */
  const longNameArb = (pid: string): fc.Arbitrary<ItemInput> =>
    fc.record({
      professionalId: fc.constant(pid),
      name: fc.string({ minLength: 101, maxLength: 200 }),
      description: fc.string({ minLength: 0, maxLength: 500 }),
      durationMinutes: fc.integer({ min: 1, max: 1440 }),
    });

  /** An ItemInput whose description exceeds 500 characters. */
  const longDescriptionArb = (pid: string): fc.Arbitrary<ItemInput> =>
    fc.record({
      professionalId: fc.constant(pid),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.string({ minLength: 501, maxLength: 700 }),
      durationMinutes: fc.integer({ min: 1, max: 1440 }),
    });

  /** An ItemInput whose duration is outside the range 1..1440. */
  const badDurationArb = (pid: string): fc.Arbitrary<ItemInput> =>
    fc.record({
      professionalId: fc.constant(pid),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.string({ minLength: 0, maxLength: 500 }),
      durationMinutes: fc.oneof(
        fc.integer({ min: -1000, max: 0 }),
        fc.integer({ min: 1441, max: 5000 }),
        fc.double({ min: 1, max: 1440, noNaN: true }).filter(n => !Number.isInteger(n)),
      ),
    });

  /** Any invalid ItemInput for the given professional. */
  const invalidInputArb = (pid: string): fc.Arbitrary<ItemInput> =>
    fc.oneof(emptyNameArb(pid), longNameArb(pid), longDescriptionArb(pid), badDurationArb(pid));

  /** Subscribe to an Observable expected to error; return true if it errored. */
  function expectRejected<T>(obs: { subscribe: Function }): boolean {
    let errored = false;
    let nexted = false;
    (obs as any).subscribe({
      next: () => (nexted = true),
      error: () => (errored = true),
    });
    return errored && !nexted;
  }

  /** Read the current owner-only Item snapshot synchronously. */
  function snapshot(service: MockItemService, pid: string): Item[] {
    let result: Item[] = [];
    service.getItemsForProfessional(pid).subscribe(items => (result = items));
    return result;
  }

  /** Pre-seed the store with a few valid items and return their snapshot. */
  function seed(service: MockItemService, pid: string, inputs: ItemInput[]): Item[] {
    for (const input of inputs) {
      service.createItem(input).subscribe();
    }
    return snapshot(service, pid);
  }

  it('rejects invalid createItem without changing the store', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain(pid =>
          fc.record({
            pid: fc.constant(pid),
            seedInputs: fc.array(validInputArb(pid), { minLength: 0, maxLength: 5 }),
            invalidInput: invalidInputArb(pid),
          }),
        ),
        ({ pid, seedInputs, invalidInput }) => {
          const service = freshService();
          const before = seed(service, pid, seedInputs);

          const rejected = expectRejected(service.createItem(invalidInput));
          const after = snapshot(service, pid);

          expect(rejected).toBeTrue();
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects invalid updateItem on an existing owned item without changing the store', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain(pid =>
          fc.record({
            pid: fc.constant(pid),
            seedInputs: fc.array(validInputArb(pid), { minLength: 1, maxLength: 5 }),
            invalidInput: invalidInputArb(pid),
          }),
        ),
        ({ pid, seedInputs, invalidInput }) => {
          const service = freshService();
          const before = seed(service, pid, seedInputs);
          const targetId = before[0].id;

          const rejected = expectRejected(service.updateItem(targetId, invalidInput));
          const after = snapshot(service, pid);

          expect(rejected).toBeTrue();
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects updateItem for an id absent from the professional list without changing the store', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain(pid =>
          fc.record({
            pid: fc.constant(pid),
            seedInputs: fc.array(validInputArb(pid), { minLength: 0, maxLength: 5 }),
            absentId: fc.string({ minLength: 1, maxLength: 30 }).map(s => `absent-${s}`),
            validInput: validInputArb(pid),
          }),
        ),
        ({ pid, seedInputs, absentId, validInput }) => {
          const service = freshService();
          const before = seed(service, pid, seedInputs);
          // Ensure the id truly does not exist in the store.
          fc.pre(!before.some(item => item.id === absentId));

          const rejected = expectRejected(service.updateItem(absentId, validInput));
          const after = snapshot(service, pid);

          expect(rejected).toBeTrue();
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects deleteItem for an id absent from the professional list without changing the store', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain(pid =>
          fc.record({
            pid: fc.constant(pid),
            seedInputs: fc.array(validInputArb(pid), { minLength: 0, maxLength: 5 }),
            absentId: fc.string({ minLength: 1, maxLength: 30 }).map(s => `absent-${s}`),
          }),
        ),
        ({ pid, seedInputs, absentId }) => {
          const service = freshService();
          const before = seed(service, pid, seedInputs);
          fc.pre(!before.some(item => item.id === absentId));

          const rejected = expectRejected(service.deleteItem(absentId, pid));
          const after = snapshot(service, pid);

          expect(rejected).toBeTrue();
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects deleteItem of an item owned by a different professional without changing the store', () => {
    fc.assert(
      fc.property(
        fc
          .tuple(professionalIdArb, professionalIdArb)
          .filter(([owner, other]) => owner !== other)
          .chain(([owner, other]) =>
            fc.record({
              owner: fc.constant(owner),
              other: fc.constant(other),
              seedInputs: fc.array(validInputArb(owner), { minLength: 1, maxLength: 5 }),
            }),
          ),
        ({ owner, other, seedInputs }) => {
          const service = freshService();
          const before = seed(service, owner, seedInputs);
          const targetId = before[0].id;

          // `other` attempts to delete an item they do not own.
          const rejected = expectRejected(service.deleteItem(targetId, other));
          const after = snapshot(service, owner);

          expect(rejected).toBeTrue();
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});
