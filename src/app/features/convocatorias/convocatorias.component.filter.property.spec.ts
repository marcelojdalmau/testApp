import { TestBed } from '@angular/core/testing';
import * as fc from 'fast-check';

import { ConvocatoriasComponent } from './convocatorias.component';
import { Convocatoria } from '../../core/models/marketplace.model';
import { SportDiscipline, UserRole } from '../../core/models/user.model';

/**
 * Property-based test for the Convocatorias search filter.
 * Feature: management-restructure, Property 1: Search filter correctness
 *
 * For any list of open Convocatoria records and any search query string, the
 * filtered result set equals exactly the set of records whose publisherName or
 * location contains the trimmed, lower-cased query as a substring
 * (case-insensitive); when the trimmed query is empty, the result equals the
 * entire open list.
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6
 */

describe('Feature: management-restructure, Property 1: Search filter correctness', () => {
  /** Valid UserRole values for publisherRole. */
  const userRoleArb: fc.Arbitrary<UserRole> = fc.constantFrom(
    'athlete',
    'health-professional',
    'coach',
    'institution',
    'management',
  );

  /** Valid SportDiscipline values. */
  const disciplineArb: fc.Arbitrary<SportDiscipline> = fc.constantFrom(
    'football',
    'basketball',
    'tennis',
    'swimming',
    'running',
    'other',
  );

  /** Valid convocatoria type values. */
  const typeArb: fc.Arbitrary<Convocatoria['type']> = fc.constantFrom(
    'job',
    'tryout',
    'sponsor',
    'service',
  );

  /**
   * Text built from a small constrained alphabet so that publisherName and
   * location frequently overlap and share substrings with the query, making
   * both match and non-match cases likely.
   */
  const smallTextArb: fc.Arbitrary<string> = fc.string({
    unit: fc.constantFrom(...'abAB xy 12'.split('')),
    minLength: 0,
    maxLength: 8,
  });

  /** A single valid open Convocatoria with overlapping publisherName/location. */
  const convocatoriaArb: fc.Arbitrary<Convocatoria> = fc.record({
    id: fc.uuid(),
    publisherId: fc.uuid(),
    publisherName: smallTextArb,
    publisherRole: userRoleArb,
    title: fc.string({ minLength: 0, maxLength: 20 }),
    description: fc.string({ minLength: 0, maxLength: 20 }),
    discipline: disciplineArb,
    location: smallTextArb,
    type: typeArb,
    createdAt: fc.date().map((d) => d.toISOString()),
    status: fc.constant<'open'>('open'),
  });

  /** A list of open Convocatoria records. */
  const listArb: fc.Arbitrary<Convocatoria[]> = fc.array(convocatoriaArb, {
    minLength: 0,
    maxLength: 20,
  });

  /** Query drawn from the same alphabet (plus surrounding whitespace variants). */
  const queryArb: fc.Arbitrary<string> = fc.oneof(
    fc.string({
      unit: fc.constantFrom(...'abAB xy 12'.split('')),
      minLength: 0,
      maxLength: 6,
    }),
    // Occasionally wrap in whitespace to exercise trimming (Requirement 2.2).
    fc
      .string({
        unit: fc.constantFrom(...'abAB xy 12'.split('')),
        minLength: 0,
        maxLength: 6,
      })
      .map((s) => `  ${s}  `),
  );

  it('filteredConvocatorias equals the reference publisherName/location case-insensitive substring filter', () => {
    fc.assert(
      fc.property(listArb, queryArb, (list: Convocatoria[], query: string) => {
        // Fresh testing module per run so signal state does not leak.
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({ imports: [ConvocatoriasComponent] });
        const fixture = TestBed.createComponent(ConvocatoriasComponent);
        const component = fixture.componentInstance;

        // Set signals directly; do not call detectChanges/ngOnInit so the values
        // we set remain authoritative (ngOnInit would overwrite from the store).
        component.allConvocatorias.set(list);
        component.searchQuery.set(query);

        const actual = component.filteredConvocatorias();

        // Reference oracle.
        const needle = query.trim().toLowerCase();
        const expected =
          needle.length === 0
            ? list
            : list.filter(
                (c) =>
                  c.publisherName.toLowerCase().includes(needle) ||
                  c.location.toLowerCase().includes(needle),
              );

        // Same elements in the same order.
        expect(actual).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});
