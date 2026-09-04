import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { TasksManagerComponent } from './tasks-manager.component';
import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { MockItemService } from '../../mock-data/services/mock-item.service';
import { CurrentUserService } from '../../core/services/current-user.service';

/**
 * Example/edge test for the Tasks management UI autocomplete.
 *
 * Validates:
 * - Requirement 5.4: WHEN a Professional types text into the Task Item selector
 *   and no Item name contains the typed text, THE Management_Area SHALL display
 *   an indication that no matching Items were found.
 */
describe('TasksManagerComponent autocomplete no-match', () => {
  let fixture: ComponentFixture<TasksManagerComponent>;
  let component: TasksManagerComponent;
  let itemService: MockItemService;

  const PROFESSIONAL_ID = 'pro-1';

  /** Stub CurrentUserService returning a fixed professional id. */
  const currentUserStub: Partial<CurrentUserService> = {
    userId: (() => PROFESSIONAL_ID) as unknown as CurrentUserService['userId'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TasksManagerComponent],
      providers: [
        provideNoopAnimations(),
        MockItemService,
        MockTaskService,
        { provide: CurrentUserService, useValue: currentUserStub },
      ],
    });

    fixture = TestBed.createComponent(TasksManagerComponent);
    component = fixture.componentInstance;
    itemService = TestBed.inject(MockItemService);
    fixture.detectChanges();
  });

  /** Query the rendered "no matching items" indicator, if present. */
  function noMatchElement(): HTMLElement | null {
    return fixture.nativeElement.querySelector('p.no-match');
  }

  it('shows the "no matching items" indication when typed text matches no Item', () => {
    // Seed one owner Item so the store is non-empty but the typed text won't match it.
    itemService
      .createItem({
        professionalId: PROFESSIONAL_ID,
        name: 'Sentadillas',
        description: '',
        durationMinutes: 20,
      })
      .subscribe();

    // Type text that no Item name contains.
    component.onItemSearch('xyz-no-such-item');
    fixture.detectChanges();

    // Component state reflects the no-match condition and offers no suggestions.
    expect(component.noMatchingItems()).toBeTrue();
    expect(component.suggestions().length).toBe(0);

    // The template renders the no-match indicator with the expected role/text.
    const indicator = noMatchElement();
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('role')).toBe('status');
    expect(indicator?.textContent?.trim()).toBe('No hay items que coincidan');
  });

  it('does not show the indication before any text is typed', () => {
    fixture.detectChanges();

    expect(component.noMatchingItems()).toBeFalse();
    expect(noMatchElement()).toBeNull();
  });

  it('hides the indication once typed text matches an Item', () => {
    itemService
      .createItem({
        professionalId: PROFESSIONAL_ID,
        name: 'Sentadillas',
        description: '',
        durationMinutes: 20,
      })
      .subscribe();

    // First a no-match, then a matching search.
    component.onItemSearch('zzz');
    fixture.detectChanges();
    expect(component.noMatchingItems()).toBeTrue();
    expect(noMatchElement()).not.toBeNull();

    component.onItemSearch('senta');
    fixture.detectChanges();

    expect(component.noMatchingItems()).toBeFalse();
    expect(component.suggestions().length).toBe(1);
    expect(noMatchElement()).toBeNull();
  });
});
