import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Item, ItemInput } from '../../core/models/management.model';
import { readArray, writeArray, nextIdFrom } from './mock-store-persistence';

/** localStorage key under which the Item store is persisted. */
const ITEMS_KEY = 'sora-sport-mock-items';

/** id prefix / counter convention for Items (`item-1`, `item-2`, ...). */
const ITEM_ID_PREFIX = 'item-';

/**
 * localStorage-persistent, signal-backed store for reusable {@link Item}
 * records.
 *
 * Unlike the other mock services (which are stateless and return static data),
 * this service maintains a mutable store. This is a deliberate, additive
 * extension of the mock-service pattern: methods still return `Observable<T>`
 * via `of(...)` / `throwError`, but mutations update an internal signal-backed
 * array AND persist it to localStorage so the data survives a page reload (F5).
 * The signal is hydrated from localStorage on construction, and the id counter
 * is restored from the max existing id so new ids stay unique.
 *
 * Validation bounds (re-validated defensively here):
 * - name: length 1..100
 * - description: length 0..500
 * - durationMinutes: integer 1..1440
 */
@Injectable({
  providedIn: 'root'
})
export class MockItemService {
  /** Internal signal-backed store of all Items across professionals. */
  private readonly items = signal<Item[]>(readArray<Item>(ITEMS_KEY));

  /** Monotonic counter used to generate unique Item ids (restored on reload). */
  private nextId = nextIdFrom(
    this.items().map(item => item.id),
    ITEM_ID_PREFIX,
  );

  /**
   * Apply an update to the Item store and persist the result to localStorage.
   * Every mutation path goes through here so the persisted copy never drifts
   * from the in-memory signal.
   */
  private setItems(updater: (items: Item[]) => Item[]): void {
    this.items.update(current => {
      const next = updater(current);
      writeArray(ITEMS_KEY, next);
      return next;
    });
  }

  /** Return the Items owned by the given professional (owner-only). */
  getItemsForProfessional(professionalId: string): Observable<Item[]> {
    return of(this.items().filter(item => item.professionalId === professionalId));
  }

  /**
   * Return at most `limit` Items owned by `professionalId` whose `name`
   * contains `text` (case-insensitive substring match).
   */
  searchItemsByName(professionalId: string, text: string, limit = 10): Observable<Item[]> {
    const needle = text.toLowerCase();
    const matches = this.items()
      .filter(item => item.professionalId === professionalId)
      .filter(item => item.name.toLowerCase().includes(needle))
      .slice(0, limit);
    return of(matches);
  }

  /**
   * Create a new Item. Assigns `id` and `createdAt` in the store.
   * Rejects via `throwError` when a validation bound is violated.
   */
  createItem(input: ItemInput): Observable<Item> {
    const validationError = this.validateInput(input);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    const item: Item = {
      id: `${ITEM_ID_PREFIX}${this.nextId++}`,
      professionalId: input.professionalId,
      name: input.name,
      description: input.description,
      durationMinutes: input.durationMinutes,
      createdAt: new Date().toISOString()
    };

    this.setItems(items => [...items, item]);
    return of(item);
  }

  /**
   * Update an existing owned Item. Rejects via `throwError` when the id is not
   * owned by `input.professionalId` / not found, or when a bound is violated.
   */
  updateItem(id: string, input: ItemInput): Observable<Item> {
    const validationError = this.validateInput(input);
    if (validationError) {
      return throwError(() => new Error(validationError));
    }

    const existing = this.items().find(
      item => item.id === id && item.professionalId === input.professionalId
    );
    if (!existing) {
      return throwError(() => new Error('No se encontró el item'));
    }

    const updated: Item = {
      ...existing,
      name: input.name,
      description: input.description,
      durationMinutes: input.durationMinutes
    };

    this.setItems(items => items.map(item => (item.id === id ? updated : item)));
    return of(updated);
  }

  /**
   * Delete an owned Item. Rejects via `throwError` when the id is not found.
   * Ownership is enforced when a `professionalId` is provided.
   */
  deleteItem(id: string, professionalId?: string): Observable<void> {
    const existing = this.items().find(
      item => item.id === id && (professionalId === undefined || item.professionalId === professionalId)
    );
    if (!existing) {
      return throwError(() => new Error('No se encontró el item'));
    }

    this.setItems(items => items.filter(item => item.id !== id));
    return of(undefined);
  }

  /**
   * Validate an {@link ItemInput} against the documented bounds.
   * Returns an error message when invalid, or `null` when valid.
   */
  private validateInput(input: ItemInput): string | null {
    if (!input.professionalId) {
      return 'El id del profesional es obligatorio';
    }
    const nameLength = input.name?.length ?? 0;
    if (nameLength < 1 || nameLength > 100) {
      return 'El nombre debe tener entre 1 y 100 caracteres';
    }
    const descriptionLength = input.description?.length ?? 0;
    if (descriptionLength > 500) {
      return 'La descripción no puede superar los 500 caracteres';
    }
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 1 ||
      input.durationMinutes > 1440
    ) {
      return 'La duración debe ser un número entero entre 1 y 1440 minutos';
    }
    return null;
  }
}
