import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';

import { MockItemService } from './mock-item.service';
import { Item, ItemInput } from '../../core/models/management.model';

/**
 * Property-based tests for MockItemService.searchItemsByName.
 * Feature: management-restructure, Property 6: Item autocomplete suggestions
 *
 * For any professional id, typed text of at least one character, and Item
 * store, searchItemsByName returns at most 10 Items, each owned by that
 * professional and each having a name that contains the typed text matched
 * case-insensitively.
 */

describe('Feature: management-restructure, Property 6: Item autocomplete suggestions', () => {
  /** A small pool of professional ids so stored Items share owners across the store. */
  const professionalIdArb: fc.Arbitrary<string> = fc.constantFrom(
    'pro-1',
    'pro-2',
    'pro-3',
  );

  /**
   * Item names built from a constrained alphabet so that names frequently share
   * substrings. Length 1..100 respects the name bound.
   */
  const nameArb: fc.Arbitrary<string> = fc.string({
    unit: fc.constantFrom(...'abcABC xyzXYZ123'.split('')),
    minLength: 1,
    maxLength: 100,
  });

  /** Valid ItemInput respecting all documented bounds. */
  const itemInputArb: fc.Arbitrary<ItemInput> = fc.record({
    professionalId: professionalIdArb,
    name: nameArb,
    description: fc.string({ minLength: 0, maxLength: 500 }),
    durationMinutes: fc.integer({ min: 1, max: 1440 }),
  });

  /** A store of valid items across multiple professionals. */
  const storeArb: fc.Arbitrary<ItemInput[]> = fc.array(itemInputArb, {
    minLength: 0,
    maxLength: 30,
  });

  /** Non-empty typed text (length >= 1) from the same alphabet as names. */
  const typedTextArb: fc.Arbitrary<string> = fc.string({
    unit: fc.constantFrom(...'abcABC xyzXYZ123'.split('')),
    minLength: 1,
    maxLength: 5,
  });

  it('returns <= 10 owner-only Items, each name-contains matching the typed text case-insensitively', () => {
    fc.assert(
      fc.property(
        storeArb,
        professionalIdArb,
        typedTextArb,
        (storeInputs: ItemInput[], queriedProfessionalId: string, text: string) => {
          // Fresh service per run so state does not leak between iterations.
          TestBed.resetTestingModule();
          localStorage.clear();
          TestBed.configureTestingModule({});
          const service = TestBed.inject(MockItemService);

          // Seed the service via createItem.
          storeInputs.forEach((input) => {
            service.createItem(input).subscribe();
          });

          let result: Item[] = [];
          service
            .searchItemsByName(queriedProfessionalId, text)
            .subscribe((items) => (result = items));

          // At most 10 results.
          expect(result.length).toBeLessThanOrEqual(10);

          const needle = text.toLowerCase();
          result.forEach((item) => {
            // Owner-only.
            expect(item.professionalId).toBe(queriedProfessionalId);
            // Case-insensitive name-contains match.
            expect(item.name.toLowerCase().includes(needle)).toBe(true);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
