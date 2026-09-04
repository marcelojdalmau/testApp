import * as fc from 'fast-check';

import { MockItemService } from './mock-item.service';
import { Item, ItemInput } from '../../core/models/management.model';

/**
 * Property-based tests for MockItemService.
 * Feature: management-restructure, Property 3: Item CRUD lifecycle and ownership round-trip
 *
 * For any valid ItemInput, creating the Item then reading it back via
 * getItemsForProfessional(professionalId) returns a record whose name,
 * description, and durationMinutes equal the input; editing an owned Item with
 * valid values makes the read-back equal the updated values; deleting an owned
 * Item makes it absent; and getItemsForProfessional(p) only ever returns Items
 * whose professionalId equals p.
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5
 */

describe('Feature: management-restructure, Property 3: Item CRUD lifecycle and ownership round-trip', () => {
  /** A valid Item name: length 1..100. */
  const nameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 });

  /** A valid Item description: length 0..500. */
  const descriptionArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 500 });

  /** A valid durationMinutes: integer 1..1440. */
  const durationArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 1440 });

  /** A professional id: a non-empty identifier string. */
  const professionalIdArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

  /** A valid ItemInput for a given professionalId. */
  const itemInputForProfessional = (professionalId: string): fc.Arbitrary<ItemInput> =>
    fc.record({
      professionalId: fc.constant(professionalId),
      name: nameArb,
      description: descriptionArb,
      durationMinutes: durationArb,
    });

  /** A fully arbitrary valid ItemInput (any professional). */
  const itemInputArb: fc.Arbitrary<ItemInput> = professionalIdArb.chain(itemInputForProfessional);

  /** Synchronously unwrap an of(...)-backed observable value. */
  const sync = <T>(obs: { subscribe: (o: { next: (v: T) => void; error: (e: unknown) => void }) => void }): T => {
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

  it('creates an Item and reads it back with equal name, description, and durationMinutes', () => {
    fc.assert(
      fc.property(itemInputArb, (input) => {
        // Fresh service per run so state does not leak between iterations.
        const service = new MockItemService();

        const created = sync<Item>(service.createItem(input));

        const readBack = sync<Item[]>(service.getItemsForProfessional(input.professionalId));
        const record = readBack.find((item) => item.id === created.id);

        expect(record).toBeTruthy();
        expect(record!.name).toBe(input.name);
        expect(record!.description).toBe(input.description);
        expect(record!.durationMinutes).toBe(input.durationMinutes);
        expect(record!.professionalId).toBe(input.professionalId);
      }),
      { numRuns: 100 },
    );
  });

  it('reflects edits to an owned Item on read-back', () => {
    fc.assert(
      fc.property(
        professionalIdArb.chain((pid) =>
          fc.tuple(itemInputForProfessional(pid), itemInputForProfessional(pid)),
        ),
        ([original, updatedInput]) => {
          const service = new MockItemService();

          const created = sync<Item>(service.createItem(original));
          sync<Item>(service.updateItem(created.id, updatedInput));

          const readBack = sync<Item[]>(service.getItemsForProfessional(original.professionalId));
          const record = readBack.find((item) => item.id === created.id);

          expect(record).toBeTruthy();
          expect(record!.name).toBe(updatedInput.name);
          expect(record!.description).toBe(updatedInput.description);
          expect(record!.durationMinutes).toBe(updatedInput.durationMinutes);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('makes a deleted owned Item absent from the read-back', () => {
    fc.assert(
      fc.property(itemInputArb, (input) => {
        const service = new MockItemService();

        const created = sync<Item>(service.createItem(input));
        sync<void>(service.deleteItem(created.id, input.professionalId));

        const readBack = sync<Item[]>(service.getItemsForProfessional(input.professionalId));
        const record = readBack.find((item) => item.id === created.id);

        expect(record).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('only ever returns Items whose professionalId equals the queried professional', () => {
    fc.assert(
      fc.property(
        fc.array(itemInputArb, { minLength: 0, maxLength: 20 }),
        professionalIdArb,
        (inputs, queriedProfessionalId) => {
          const service = new MockItemService();

          for (const input of inputs) {
            sync<Item>(service.createItem(input));
          }

          const readBack = sync<Item[]>(service.getItemsForProfessional(queriedProfessionalId));

          // Every returned Item must be owned by the queried professional.
          const allOwned = readBack.every((item) => item.professionalId === queriedProfessionalId);
          expect(allOwned).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
