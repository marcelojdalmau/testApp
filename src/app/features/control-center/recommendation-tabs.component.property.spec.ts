import * as fc from 'fast-check';
import { of } from 'rxjs';

import { TestBed } from '@angular/core/testing';

import { RecommendationTabsComponent } from './recommendation-tabs.component';
import { MockClubService } from '../../mock-data/services/mock-club.service';
import { StaffRecommendation } from '../../core/models/club.model';

/**
 * Property-based test for the athlete Control Center recommendation grouping.
 * Feature: management-restructure, Property 13: Control Center recommendations are owner-only, grouped, and most-recent-first
 *
 * For any athlete id and any recommendation store (a mix of records for the
 * target athlete and for other athletes, across the five types, with varied
 * createdAt timestamps), the grouped recommendation view SHALL:
 *  - contain only recommendations whose owner (playerId) is that athlete (8.2),
 *  - produce exactly one non-empty group per distinct type present, and no
 *    group for absent types (8.1, 8.4),
 *  - order recommendations within each group most-recent-first by createdAt (8.3).
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
describe('Feature: management-restructure, Property 13: Control Center recommendations are owner-only, grouped, and most-recent-first', () => {
  /** The five recommendation types. */
  const TYPES: StaffRecommendation['type'][] = [
    'diet',
    'exercise',
    'rehabilitation',
    'psychological',
    'tactical',
  ];

  /** The target athlete id used across a run. */
  const TARGET_ID = 'athlete-target';

  /**
   * playerId drawn from a small set including the target athlete id and a few
   * other ids, so runs mix owned and non-owned records.
   */
  const playerIdArb: fc.Arbitrary<string> = fc.constantFrom(
    TARGET_ID,
    'athlete-other-1',
    'athlete-other-2',
    'athlete-other-3',
  );

  const typeArb: fc.Arbitrary<StaffRecommendation['type']> = fc.constantFrom(...TYPES);

  /**
   * createdAt as ISO strings from varied timestamps. `noInvalidDate` keeps
   * fast-check from generating an `Invalid Date`, whose `toISOString()` throws
   * ("RangeError: Invalid time value") and made this property flaky.
   */
  const createdAtArb: fc.Arbitrary<string> = fc
    .date({ noInvalidDate: true })
    .map((d) => d.toISOString());

  /** A single arbitrary StaffRecommendation with an index-scoped unique id. */
  const recommendationArb = (index: number): fc.Arbitrary<StaffRecommendation> =>
    fc.record({
      playerId: playerIdArb,
      staffId: fc.constant('staff-1'),
      staffName: fc.constant('Staff Member'),
      staffRole: fc.constant('Coach'),
      type: typeArb,
      title: fc.string({ minLength: 0, maxLength: 20 }),
      description: fc.string({ minLength: 0, maxLength: 40 }),
      details: fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
      createdAt: createdAtArb,
      status: fc.constantFrom<StaffRecommendation['status']>('active', 'completed', 'pending'),
    }).map((rec) => ({ ...rec, id: `rec-${index}` }));

  /** A store of 0..30 recommendations, each with a unique id. */
  const storeArb: fc.Arbitrary<StaffRecommendation[]> = fc
    .array(fc.integer(), { minLength: 0, maxLength: 30 })
    .chain((seedList) =>
      seedList.length === 0
        ? fc.constant<StaffRecommendation[]>([])
        : fc.tuple(...seedList.map((_, i) => recommendationArb(i))),
    );

  /**
   * Build a fresh component instance per run so signal state does not leak.
   * The stub MockClubService returns the FULL generated array; the component
   * itself filters to owner-only (playerId === athleteId), so this exercises
   * the owner-only behavior (8.2) end-to-end.
   */
  function buildComponent(store: StaffRecommendation[]): RecommendationTabsComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RecommendationTabsComponent],
      providers: [
        {
          provide: MockClubService,
          useValue: {
            getRecommendationsForPlayer: (_playerId: string) => of(store),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RecommendationTabsComponent);
    fixture.componentRef.setInput('athleteId', TARGET_ID);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('produces owner-only, per-present-type, most-recent-first groups', () => {
    fc.assert(
      fc.property(storeArb, (store) => {
        const component = buildComponent(store);
        const groups = component.groupedRecommendations();

        // The set of the target athlete's owned recommendations.
        const owned = store.filter((rec) => rec.playerId === TARGET_ID);
        const presentTypes = new Set(owned.map((rec) => rec.type));

        // 8.1 / 8.4: exactly one group per distinct present type, none for absent types.
        expect(groups.length).toBe(presentTypes.size);
        const groupTypes = groups.map((g) => g.type);
        expect(new Set(groupTypes).size).toBe(groups.length); // no duplicate-type groups
        for (const g of groups) {
          expect(presentTypes.has(g.type)).toBe(true);
          // Every group is non-empty.
          expect(g.recommendations.length).toBeGreaterThan(0);
        }

        for (const g of groups) {
          for (let i = 0; i < g.recommendations.length; i++) {
            const rec = g.recommendations[i];
            // 8.2: owner-only — no other athlete's records appear.
            expect(rec.playerId).toBe(TARGET_ID);
            // Each recommendation in a group matches that group's type.
            expect(rec.type).toBe(g.type);

            // 8.3: most-recent-first — each element's createdAt >= the next's.
            if (i < g.recommendations.length - 1) {
              const current = new Date(rec.createdAt).getTime();
              const next = new Date(g.recommendations[i + 1].createdAt).getTime();
              expect(current).toBeGreaterThanOrEqual(next);
            }
          }
        }

        // 8.4 (completeness): the union of all group recommendations equals
        // exactly the set of the athlete's owned recommendations.
        const flattenedIds = groups
          .flatMap((g) => g.recommendations.map((r) => r.id))
          .sort();
        const ownedIds = owned.map((r) => r.id).sort();
        expect(flattenedIds).toEqual(ownedIds);
      }),
      { numRuns: 100 },
    );
  });
});
