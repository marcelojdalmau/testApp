import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ItemsManagerComponent } from './items-manager.component';
import { MockItemService } from '../../mock-data/services/mock-item.service';
import { CurrentUserService } from '../../core/services/current-user.service';
import { Item } from '../../core/models/management.model';

/**
 * Example tests for the Items management UI validation and error states.
 *
 * Validates:
 * - Requirement 4.6: boundary/invalid inputs (empty name, name > 100,
 *   description > 500, duration outside 1-1440) surface field-specific messages
 *   and retain the entered values.
 * - Requirement 4.7: a not-found edit/delete surfaces the not-found message and
 *   leaves the displayed list unchanged.
 */
describe('ItemsManagerComponent validation and error states', () => {
  let fixture: ComponentFixture<ItemsManagerComponent>;
  let component: ItemsManagerComponent;
  let itemService: MockItemService;

  const PROFESSIONAL_ID = 'pro-1';

  /** Stub CurrentUserService returning a fixed professional id. */
  const currentUserStub: Partial<CurrentUserService> = {
    userId: (() => PROFESSIONAL_ID) as unknown as CurrentUserService['userId'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ItemsManagerComponent],
      providers: [
        provideNoopAnimations(),
        MockItemService,
        { provide: CurrentUserService, useValue: currentUserStub },
      ],
    });

    fixture = TestBed.createComponent(ItemsManagerComponent);
    component = fixture.componentInstance;
    itemService = TestBed.inject(MockItemService);
    fixture.detectChanges();
  });

  /** Fill the reactive form with the given values. */
  function fillForm(name: string, description: string, durationMinutes: number | null): void {
    component.form.setValue({ name, description, durationMinutes });
  }

  // ---------------------------------------------------------------------------
  // Requirement 4.6 - invalid inputs surface messages and retain values
  // ---------------------------------------------------------------------------
  describe('invalid inputs surface field-specific messages and retain values (4.6)', () => {
    it('rejects an empty name, retains values, and shows a name message', () => {
      fillForm('', 'valid description', 30);

      component.submit();

      expect(component.items().length).toBe(0);
      expect(component.form.get('name')?.invalid).toBeTrue();
      expect(component.nameError()).toContain('nombre');
      // Entered values retained.
      expect(component.form.value.description).toBe('valid description');
      expect(component.form.value.durationMinutes).toBe(30);
    });

    it('rejects a name longer than 100 characters and shows a name message', () => {
      fillForm('a'.repeat(101), 'desc', 30);

      component.submit();

      expect(component.items().length).toBe(0);
      expect(component.form.get('name')?.invalid).toBeTrue();
      expect(component.nameError()).toContain('nombre');
      // Retained value.
      expect(component.form.value.name?.length).toBe(101);
    });

    it('rejects a description longer than 500 characters and shows a description message', () => {
      fillForm('Valid name', 'd'.repeat(501), 30);

      component.submit();

      expect(component.items().length).toBe(0);
      expect(component.form.get('description')?.invalid).toBeTrue();
      expect(component.descriptionError()).toContain('descripción');
      expect(component.form.value.description?.length).toBe(501);
    });

    it('rejects a duration below 1 and shows a duration message', () => {
      fillForm('Valid name', 'desc', 0);

      component.submit();

      expect(component.items().length).toBe(0);
      expect(component.form.get('durationMinutes')?.invalid).toBeTrue();
      expect(component.durationError()).toContain('duración');
      expect(component.form.value.durationMinutes).toBe(0);
    });

    it('rejects a duration above 1440 and shows a duration message', () => {
      fillForm('Valid name', 'desc', 1441);

      component.submit();

      expect(component.items().length).toBe(0);
      expect(component.form.get('durationMinutes')?.invalid).toBeTrue();
      expect(component.durationError()).toContain('duración');
      expect(component.form.value.durationMinutes).toBe(1441);
    });

    it('accepts a valid item at the boundaries and adds it to the list', () => {
      fillForm('a'.repeat(100), 'd'.repeat(500), 1440);

      component.submit();

      expect(component.items().length).toBe(1);
      expect(component.items()[0].name.length).toBe(100);
      expect(component.items()[0].durationMinutes).toBe(1440);
    });
  });

  // ---------------------------------------------------------------------------
  // Requirement 4.7 - not-found edit/delete shows message, list unchanged
  // ---------------------------------------------------------------------------
  describe('not-found edit/delete surfaces the message and leaves the list unchanged (4.7)', () => {
    /** Build a phantom Item that is not present in the store. */
    function phantomItem(): Item {
      return {
        id: 'does-not-exist',
        professionalId: PROFESSIONAL_ID,
        name: 'Phantom',
        description: 'not in store',
        durationMinutes: 10,
        createdAt: new Date().toISOString(),
      };
    }

    it('surfaces a not-found message and leaves the list unchanged on delete', () => {
      // Seed one real item so the list is non-empty.
      itemService
        .createItem({
          professionalId: PROFESSIONAL_ID,
          name: 'Real item',
          description: '',
          durationMinutes: 20,
        })
        .subscribe();
      component.ngOnInit();
      const before = component.items();
      expect(before.length).toBe(1);

      component.delete(phantomItem());

      expect(component.errorMessage()).toContain('No se encontró');
      // List unchanged.
      expect(component.items().length).toBe(1);
      expect(component.items()[0].name).toBe('Real item');
    });

    it('surfaces a not-found message and leaves the list unchanged on edit save', () => {
      itemService
        .createItem({
          professionalId: PROFESSIONAL_ID,
          name: 'Real item',
          description: '',
          durationMinutes: 20,
        })
        .subscribe();
      component.ngOnInit();
      expect(component.items().length).toBe(1);

      // Enter edit mode for a phantom (absent) item with otherwise-valid values.
      component.edit(phantomItem());
      fillForm('Updated name', 'desc', 30);

      component.submit();

      expect(component.errorMessage()).toContain('No se encontró');
      // The store still holds only the original real item.
      expect(component.items().length).toBe(1);
      expect(component.items()[0].name).toBe('Real item');
    });
  });
});
