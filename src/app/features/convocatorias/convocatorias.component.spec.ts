import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ConvocatoriasComponent } from './convocatorias.component';
import { Convocatoria } from '../../core/models/marketplace.model';

/**
 * Example / edge / fakeAsync tests for the Convocatorias search.
 *
 * Validates:
 * - Requirement 2.1: the search input accepts 0-100 characters (maxlength=100,
 *   onSearchInput clamps longer input to 100).
 * - Requirement 2.7: the displayed list updates within the debounce window
 *   (well under 1 second).
 * - Requirement 2.8: when no open convocatoria matches, an empty-result
 *   indicator is shown and the entered query is retained.
 */
describe('ConvocatoriasComponent search', () => {
  let fixture: ComponentFixture<ConvocatoriasComponent>;
  let component: ConvocatoriasComponent;

  /** Build a minimal valid Convocatoria fixture. */
  function makeConvocatoria(overrides: Partial<Convocatoria> = {}): Convocatoria {
    return {
      id: overrides.id ?? 'c1',
      publisherId: overrides.publisherId ?? 'p1',
      publisherName: overrides.publisherName ?? 'Club Atletico',
      publisherRole: overrides.publisherRole ?? 'institution',
      title: overrides.title ?? 'Buscamos jugador',
      description: overrides.description ?? 'Descripcion de la convocatoria',
      discipline: overrides.discipline ?? 'football',
      location: overrides.location ?? 'Buenos Aires',
      type: overrides.type ?? 'job',
      createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
      status: overrides.status ?? 'open',
      ...overrides,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConvocatoriasComponent],
      providers: [provideNoopAnimations()],
    });

    fixture = TestBed.createComponent(ConvocatoriasComponent);
    component = fixture.componentInstance;
  });

  // ---------------------------------------------------------------------------
  // 1. Boundary / length tests (Requirement 2.1)
  // ---------------------------------------------------------------------------
  describe('query length boundaries (2.1)', () => {
    it('renders the search input with maxlength=100', () => {
      fixture.detectChanges();

      const input: HTMLInputElement | null =
        fixture.nativeElement.querySelector('input[matInput]');

      expect(input).withContext('search input should exist').toBeTruthy();
      expect(input?.getAttribute('maxlength')).toBe('100');
    });

    it('accepts a 0-character query as-is', fakeAsync(() => {
      component.onSearchInput('');
      tick(250);

      expect(component.searchQuery()).toBe('');
      expect(component.searchQuery().length).toBe(0);
    }));

    it('accepts a 100-character query as-is', fakeAsync(() => {
      const exactly100 = 'a'.repeat(100);

      component.onSearchInput(exactly100);
      tick(250);

      expect(component.searchQuery().length).toBe(100);
      expect(component.searchQuery()).toBe(exactly100);
    }));

    it('clamps a 101-character query down to 100 characters', fakeAsync(() => {
      const tooLong = 'a'.repeat(101);

      component.onSearchInput(tooLong);
      tick(250);

      expect(component.searchQuery().length).toBe(100);
      expect(component.searchQuery()).toBe('a'.repeat(100));
    }));
  });

  // ---------------------------------------------------------------------------
  // 2. Debounce timing (Requirement 2.7)
  // ---------------------------------------------------------------------------
  describe('debounced update timing (2.7)', () => {
    it('updates searchQuery only after the debounce elapses, well within 1s', fakeAsync(() => {
      component.onSearchInput('someQuery');

      // Before the debounce window elapses, the signal still holds the old value.
      tick(100);
      expect(component.searchQuery()).toBe('');

      // Completing the 250ms debounce window (< 1s) applies the update.
      tick(150);
      expect(component.searchQuery()).toBe('someQuery');
    }));

    it('reflects the applied query in the filtered list after the debounce', fakeAsync(() => {
      component.allConvocatorias.set([
        makeConvocatoria({ id: 'a', publisherName: 'River Plate', location: 'Cordoba' }),
        makeConvocatoria({ id: 'b', publisherName: 'Boca', location: 'Rosario' }),
      ]);

      component.onSearchInput('river');
      tick(250);

      const filtered = component.filteredConvocatorias();
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('a');
    }));
  });

  // ---------------------------------------------------------------------------
  // 3. No-match behavior (Requirement 2.8)
  // ---------------------------------------------------------------------------
  describe('no-match empty-result indicator (2.8)', () => {
    it('shows the empty-result indicator and retains the query when nothing matches', fakeAsync(() => {
      component.allConvocatorias.set([
        makeConvocatoria({ id: 'a', publisherName: 'Club Norte', location: 'Salta' }),
        makeConvocatoria({ id: 'b', publisherName: 'Club Sur', location: 'Mendoza' }),
      ]);

      component.onSearchInput('zzz-no-such-match');
      tick(250);

      expect(component.noMatches()).toBeTrue();
      expect(component.filteredConvocatorias().length).toBe(0);
      // The entered query is retained.
      expect(component.searchQuery()).toBe('zzz-no-such-match');

      fixture.detectChanges();

      const emptyResult = fixture.nativeElement.querySelector('.empty-result');
      expect(emptyResult).withContext('empty-result indicator should render').toBeTruthy();

      const icons: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.empty-result mat-icon'),
      );
      const hasSearchOff = icons.some(icon => icon.textContent?.trim() === 'search_off');
      expect(hasSearchOff).withContext('search_off icon should be shown').toBeTrue();
    }));
  });
});
