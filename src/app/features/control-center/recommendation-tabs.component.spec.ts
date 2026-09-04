import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { RecommendationTabsComponent } from './recommendation-tabs.component';
import { MockClubService } from '../../mock-data/services/mock-club.service';
import { StaffRecommendation } from '../../core/models/club.model';

/**
 * Example test for the athlete Control Center recommendation tabs load-error
 * behaviour.
 *
 * Validates:
 * - Requirement 8.5: when a subsequent recommendation load fails, the
 *   previously displayed recommendations are retained unchanged and a
 *   load-error indication is shown.
 */
describe('RecommendationTabsComponent load failure (8.5)', () => {
  let fixture: ComponentFixture<RecommendationTabsComponent>;
  let component: RecommendationTabsComponent;
  let clubServiceSpy: jasmine.SpyObj<MockClubService>;

  const ATHLETE_ID = 'athlete-1';

  /** Build a recommendation owned by the athlete under test. */
  function rec(
    id: string,
    type: StaffRecommendation['type'],
    createdAt: string,
  ): StaffRecommendation {
    return {
      id,
      playerId: ATHLETE_ID,
      staffId: 'staff-1',
      staffName: 'Dr. Example',
      staffRole: 'Nutricionista',
      type,
      title: `Title ${id}`,
      description: `Description ${id}`,
      details: [],
      createdAt,
      status: 'active',
    };
  }

  const FIRST_RESULT: StaffRecommendation[] = [
    rec('r1', 'diet', '2024-01-02T10:00:00.000Z'),
    rec('r2', 'exercise', '2024-01-03T10:00:00.000Z'),
  ];

  beforeEach(() => {
    clubServiceSpy = jasmine.createSpyObj<MockClubService>('MockClubService', [
      'getRecommendationsForPlayer',
    ]);
    // First load succeeds with the athlete's recommendations.
    clubServiceSpy.getRecommendationsForPlayer.and.returnValue(of(FIRST_RESULT));

    TestBed.configureTestingModule({
      imports: [RecommendationTabsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MockClubService, useValue: clubServiceSpy },
      ],
    });

    fixture = TestBed.createComponent(RecommendationTabsComponent);
    component = fixture.componentInstance;
  });

  it('retains previously displayed recommendations and shows an error when a subsequent load fails', () => {
    // First load: the effect fires on the first change detection once the input is set.
    fixture.componentRef.setInput('athleteId', ATHLETE_ID);
    fixture.detectChanges();

    // Snapshot of the successful first load.
    expect(component.loadError()).toBeFalse();
    expect(component.recommendations()).toEqual(FIRST_RESULT);
    const groupsAfterSuccess = component.groupedRecommendations();
    expect(groupsAfterSuccess.length).toBe(2);
    // Groups surface the two present types (diet + exercise).
    expect(groupsAfterSuccess.map(g => g.type).sort()).toEqual(['diet', 'exercise']);
    // No error alert in the DOM yet.
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    // Reconfigure the stub so the next load fails.
    clubServiceSpy.getRecommendationsForPlayer.and.returnValue(
      throwError(() => new Error('boom')),
    );

    // Trigger a subsequent load explicitly.
    component.load(ATHLETE_ID);
    fixture.detectChanges();

    // Error flag is set and the error indication renders.
    expect(component.loadError()).toBeTrue();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('No se pudieron cargar las recomendaciones.');

    // Previously displayed recommendations are retained unchanged.
    expect(component.recommendations()).toEqual(FIRST_RESULT);
    const groupsAfterFailure = component.groupedRecommendations();
    expect(groupsAfterFailure).toEqual(groupsAfterSuccess);
  });
});
