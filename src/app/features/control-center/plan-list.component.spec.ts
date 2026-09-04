import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatCheckboxChange } from '@angular/material/checkbox';

import { PlanListComponent } from './plan-list.component';

/**
 * Example tests for the athlete Control Center plan list.
 *
 * The plans are a local (hardcoded) demo seed pending a backend call, so these
 * tests exercise the component's own state instead of a mock service:
 * - Three plans are shown, each with exactly 10 checkable items.
 * - Each plan can be toggled active/inactive independently.
 * - Item checkboxes reflect per-item completion state.
 */
describe('PlanListComponent (local seed)', () => {
  let fixture: ComponentFixture<PlanListComponent>;
  let component: PlanListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlanListComponent],
      providers: [provideNoopAnimations()],
    });

    fixture = TestBed.createComponent(PlanListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('athleteId', 'athlete-1');
    fixture.detectChanges();
  });

  it('shows three plans, each with 10 items', () => {
    const plans = component.plans();
    expect(plans.length).toBe(3);
    for (const plan of plans) {
      expect(plan.items.length).toBe(10);
    }

    // Titles cover the three requested domains.
    const titles = plans.map(p => p.title.toLowerCase());
    expect(titles.some(t => t.includes('ejercicio'))).toBeTrue();
    expect(titles.some(t => t.includes('nutrición'))).toBeTrue();
    expect(titles.some(t => t.includes('kinesiolog'))).toBeTrue();

    // One card is rendered per plan.
    const cards = fixture.nativeElement.querySelectorAll('.plan-list__card');
    expect(cards.length).toBe(3);
  });

  it('every item starts not completed', () => {
    const allItems = component.plans().flatMap(plan => plan.items);
    expect(allItems.length).toBe(30);
    expect(allItems.every(item => !item.completed)).toBeTrue();
  });

  it('toggles a plan active and inactive independently', () => {
    const [first, second] = component.plans();
    expect(first.active).toBeFalse();

    component.onToggleActive(first.id);
    expect(component.plans().find(p => p.id === first.id)?.active).toBeTrue();
    // Other plans are unaffected.
    expect(component.plans().find(p => p.id === second.id)?.active).toBeFalse();

    // Toggling again deactivates it.
    component.onToggleActive(first.id);
    expect(component.plans().find(p => p.id === first.id)?.active).toBeFalse();
  });

  it('renders the active indicator only on active plans', () => {
    const first = component.plans()[0];
    component.onToggleActive(first.id);
    fixture.detectChanges();

    const indicators = fixture.nativeElement.querySelectorAll(
      '.plan-list__active-indicator',
    );
    expect(indicators.length).toBe(1);

    const activeCards = fixture.nativeElement.querySelectorAll(
      '.plan-list__card--active',
    );
    expect(activeCards.length).toBe(1);
  });

  it('updates an item completion state when toggled', () => {
    const plan = component.plans()[0];
    const item = plan.items[0];
    expect(item.completed).toBeFalse();

    component.onToggleItem(plan.id, item.id, { checked: true } as MatCheckboxChange);

    const updated = component
      .plans()
      .find(p => p.id === plan.id)
      ?.items.find(i => i.id === item.id);
    expect(updated?.completed).toBeTrue();
    expect(component.completedCount(component.plans()[0])).toBe(1);
  });
});
