import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';

import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { MockItemService } from '../../mock-data/services/mock-item.service';
import { CurrentUserService } from '../../core/services/current-user.service';
import { Item, Task, TaskInput } from '../../core/models/management.model';

/** Validation bounds for a Task (mirrors the design bounds table). */
const NAME_MIN = 1;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 1000;
const ITEMS_MIN = 1;
const ITEMS_MAX = 100;

/** Maximum number of autocomplete suggestions surfaced to the user. */
const SUGGESTION_LIMIT = 10;

/**
 * Professional-facing Tasks CRUD surface.
 *
 * Standalone, OnPush, signal-driven. Uses a reactive form whose validators
 * enforce the Task bounds (name 1..100, description 0..1000, items 1..100) and
 * calls {@link MockTaskService} for create/update/delete. The signed-in
 * professional's id is resolved from {@link CurrentUserService}.
 *
 * Item selection (Requirements 5.3, 5.4, 5.5): a `mat-autocomplete` fed by
 * {@link MockItemService.searchItemsByName} shows up to 10 owner-only Items
 * whose name contains the typed text (case-insensitive). When the typed text
 * matches no Item, a "no matching items" indication is shown. Selecting a
 * suggestion appends its id to the end of the ordered `itemIds` list,
 * preserving insertion order.
 *
 * Error handling (Requirements 5.8, 5.9, 5.10): on validation failure or a
 * not-found service error, the entered form values (and the current ordered
 * item list) are retained, the offending control is marked invalid, and a
 * field-specific message is rendered.
 */
@Component({
  selector: 'app-tasks-manager',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
  ],
  templateUrl: './tasks-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tasks-manager.component.scss',
})
export class TasksManagerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taskService = inject(MockTaskService);
  private readonly itemService = inject(MockItemService);
  private readonly currentUser = inject(CurrentUserService);

  /** Exposed bounds for the template (hints / maxlength attributes). */
  readonly nameMax = NAME_MAX;
  readonly descriptionMax = DESCRIPTION_MAX;
  readonly itemsMin = ITEMS_MIN;
  readonly itemsMax = ITEMS_MAX;

  /** The signed-in professional's id. */
  readonly professionalId = computed(() => this.currentUser.userId());

  /** The professional's Tasks as displayed in the list. */
  readonly tasks = signal<Task[]>([]);

  /** The id of the Task currently being edited, or null when creating. */
  readonly editingId = signal<string | null>(null);

  /** True while the Tasks list is being (re-)read from the store. */
  readonly loading = signal<boolean>(false);

  /** A general (not field-specific) error message, e.g. "Task not found". */
  readonly errorMessage = signal<string | null>(null);

  /**
   * The ordered list of Items selected for the Task being composed. Order is
   * preserved: selecting a suggestion appends to the end (Requirement 5.5).
   */
  readonly selectedItems = signal<Item[]>([]);

  /** The current autocomplete suggestions for the typed text. */
  readonly suggestions = signal<Item[]>([]);

  /**
   * True when the user has typed at least one character but no owner-Item name
   * matches it, driving the "no matching items" indication (Requirement 5.4).
   */
  readonly noMatchingItems = signal<boolean>(false);

  /** The free-text control backing the Item autocomplete input. */
  readonly itemSearchControl = new FormControl<string>('', { nonNullable: true });

  /** Reactive form enforcing the Task name/description bounds. */
  readonly form: FormGroup = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(NAME_MIN), Validators.maxLength(NAME_MAX)],
    ],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX)]],
  });

  ngOnInit(): void {
    this.reloadTasks();
  }

  /** Re-read the professional's Tasks from the store (synchronous in-memory). */
  private reloadTasks(): void {
    this.loading.set(true);
    this.taskService.getTasksForProfessional(this.professionalId()).subscribe({
      next: tasks => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** True when the form is in edit mode for an existing Task. */
  readonly isEditing = computed(() => this.editingId() !== null);

  /** The ordered item ids currently selected (derived from selectedItems). */
  private selectedItemIds(): string[] {
    return this.selectedItems().map(item => item.id);
  }

  /**
   * Handle typing in the Item autocomplete input. Fetches up to 10 owner-only
   * Items whose name contains the typed text case-insensitively; when the text
   * is non-empty but yields no match, the "no matching items" indication is
   * shown. Already-selected Items are excluded from the suggestions.
   */
  onItemSearch(text: string): void {
    const trimmed = (text ?? '').trim();
    if (trimmed.length === 0) {
      this.suggestions.set([]);
      this.noMatchingItems.set(false);
      return;
    }

    this.itemService
      .searchItemsByName(this.professionalId(), trimmed, SUGGESTION_LIMIT)
      .subscribe(matches => {
        const alreadySelected = new Set(this.selectedItemIds());
        const available = matches.filter(item => !alreadySelected.has(item.id));
        this.suggestions.set(available);
        // "No matching items" reflects that no Item name contains the text at
        // all, independent of what is already selected.
        this.noMatchingItems.set(matches.length === 0);
      });
  }

  /**
   * Append the selected suggestion to the ordered item list (Requirement 5.5)
   * and clear the search input for the next selection.
   */
  onItemSelected(event: MatAutocompleteSelectedEvent): void {
    const item = event.option.value as Item;
    if (!item) {
      return;
    }
    if (!this.selectedItemIds().includes(item.id)) {
      this.selectedItems.update(items => [...items, item]);
    }
    this.itemSearchControl.setValue('');
    this.suggestions.set([]);
    this.noMatchingItems.set(false);
  }

  /** Remove an Item from the ordered selection. */
  removeItem(itemId: string): void {
    this.selectedItems.update(items => items.filter(item => item.id !== itemId));
  }

  /** Display text for an autocomplete option (its Item name). */
  displayItem(item: Item | null): string {
    return item ? item.name : '';
  }

  /**
   * Submit the form as a create (when not editing) or an update (when editing).
   * On validation failure the submission is rejected and messages are shown
   * while entered values and the ordered item list are retained.
   */
  submit(): void {
    this.errorMessage.set(null);

    const hasItems = this.selectedItems().length >= ITEMS_MIN;

    if (this.form.invalid || !hasItems) {
      // Retain entered values and surface field-specific messages.
      this.form.markAllAsTouched();
      if (!hasItems) {
        this.errorMessage.set('La tarea debe tener al menos un item');
      }
      return;
    }

    const input: TaskInput = {
      professionalId: this.professionalId(),
      name: this.form.value.name ?? '',
      description: this.form.value.description ?? '',
      itemIds: this.selectedItemIds(),
    };

    const editingId = this.editingId();
    const request$ = editingId
      ? this.taskService.updateTask(editingId, input)
      : this.taskService.createTask(input);

    request$.subscribe({
      next: () => {
        this.reloadTasks();
        this.resetForm();
      },
      error: (err: unknown) => this.handleServiceError(err),
    });
  }

  /**
   * Populate the form for editing an existing Task, retaining its values and
   * resolving its ordered Items from the Item store.
   */
  edit(task: Task): void {
    this.errorMessage.set(null);
    this.editingId.set(task.id);
    this.form.setValue({
      name: task.name,
      description: task.description,
    });
    // Resolve the ordered items from the store, preserving the Task's order.
    this.itemService.getItemsForProfessional(this.professionalId()).subscribe(items => {
      const byId = new Map(items.map(item => [item.id, item]));
      const ordered = task.itemIds
        .map(id => byId.get(id))
        .filter((item): item is Item => item !== undefined);
      this.selectedItems.set(ordered);
    });
    this.itemSearchControl.setValue('');
    this.suggestions.set([]);
    this.noMatchingItems.set(false);
  }

  /** Delete a Task and refresh the list on success. */
  delete(task: Task): void {
    this.errorMessage.set(null);
    this.taskService.deleteTask(task.id, this.professionalId()).subscribe({
      next: () => {
        if (this.editingId() === task.id) {
          this.resetForm();
        }
        this.reloadTasks();
      },
      error: (err: unknown) => this.handleServiceError(err),
    });
  }

  /** Cancel the current edit and clear the form. */
  cancelEdit(): void {
    this.resetForm();
  }

  /** Reset the form and selection to their pristine create state. */
  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '' });
    this.selectedItems.set([]);
    this.itemSearchControl.setValue('');
    this.suggestions.set([]);
    this.noMatchingItems.set(false);
  }

  /**
   * Map a service error to the UI: mark the offending control invalid with a
   * field-specific error when the message identifies a field, otherwise show a
   * general error (e.g. "Task not found"). Entered values are always retained.
   */
  private handleServiceError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);

    if (/name|nombre/i.test(message)) {
      this.form.get('name')?.setErrors({ server: message });
    } else if (/description|descripci[oó]n/i.test(message)) {
      this.form.get('description')?.setErrors({ server: message });
    }

    // Always surface the raw message (covers not-found, items, field messages).
    this.errorMessage.set(message);
  }

  /** Field-specific error text for the name control. */
  nameError(): string | null {
    const control = this.form.get('name');
    if (!control || !(control.touched || control.dirty) || control.valid) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server');
    }
    return `El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres`;
  }

  /** Field-specific error text for the description control. */
  descriptionError(): string | null {
    const control = this.form.get('description');
    if (!control || !(control.touched || control.dirty) || control.valid) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server');
    }
    return `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres`;
  }

  /**
   * Field-specific error text for the items selection: shown once the user has
   * attempted to submit (form touched) with no Items selected.
   */
  itemsError(): string | null {
    if (this.selectedItems().length >= ITEMS_MIN) {
      return null;
    }
    if (!this.form.touched) {
      return null;
    }
    return `La tarea debe tener entre ${ITEMS_MIN} y ${ITEMS_MAX} items`;
  }
}
