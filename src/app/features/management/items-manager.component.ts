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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MockItemService } from '../../mock-data/services/mock-item.service';
import { CurrentUserService } from '../../core/services/current-user.service';
import { Item, ItemInput } from '../../core/models/management.model';

/** Validation bounds for an Item (mirrors the design bounds table). */
const NAME_MIN = 1;
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const DURATION_MIN = 1;
const DURATION_MAX = 1440;

/**
 * Professional-facing Items CRUD surface.
 *
 * Standalone, OnPush, signal-driven. Uses a reactive form whose validators
 * enforce the Item bounds (name 1..100, description 0..500, duration 1..1440)
 * and calls {@link MockItemService} for create/update/delete. The signed-in
 * professional's id is resolved from {@link CurrentUserService}.
 *
 * Error handling (Requirements 4.6, 4.7): on validation failure or a
 * not-found service error, the entered form values are retained, the offending
 * control is marked invalid, and a field-specific message is rendered. After a
 * successful delete the list is re-read synchronously (well within the 2s bound
 * since the store is in-memory).
 */
@Component({
  selector: 'app-items-manager',
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
    MatProgressSpinnerModule,
  ],
  templateUrl: './items-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './items-manager.component.scss',
})
export class ItemsManagerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly itemService = inject(MockItemService);
  private readonly currentUser = inject(CurrentUserService);

  /** Exposed bounds for the template (hints / maxlength attributes). */
  readonly nameMax = NAME_MAX;
  readonly descriptionMax = DESCRIPTION_MAX;
  readonly durationMin = DURATION_MIN;
  readonly durationMax = DURATION_MAX;

  /** The signed-in professional's id. */
  readonly professionalId = computed(() => this.currentUser.userId());

  /** The professional's Items as displayed in the list. */
  readonly items = signal<Item[]>([]);

  /** The id of the Item currently being edited, or null when creating. */
  readonly editingId = signal<string | null>(null);

  /** True while the Items list is being (re-)read from the store. */
  readonly loading = signal<boolean>(false);

  /** A general (not field-specific) error message, e.g. "Item not found". */
  readonly errorMessage = signal<string | null>(null);

  /** Reactive form enforcing the Item bounds. */
  readonly form: FormGroup = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.minLength(NAME_MIN), Validators.maxLength(NAME_MAX)],
    ],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX)]],
    durationMinutes: [
      null,
      [
        Validators.required,
        Validators.min(DURATION_MIN),
        Validators.max(DURATION_MAX),
        integerValidator,
      ],
    ],
  });

  ngOnInit(): void {
    this.reloadItems();
  }

  /** Re-read the professional's Items from the store (synchronous in-memory). */
  private reloadItems(): void {
    this.loading.set(true);
    this.itemService.getItemsForProfessional(this.professionalId()).subscribe({
      next: items => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** True when the form is in edit mode for an existing Item. */
  readonly isEditing = computed(() => this.editingId() !== null);

  /**
   * Submit the form as a create (when not editing) or an update (when editing).
   * On validation failure the submission is rejected and messages are shown
   * while entered values are retained.
   */
  submit(): void {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      // Retain entered values and surface field-specific messages.
      this.form.markAllAsTouched();
      return;
    }

    const input: ItemInput = {
      professionalId: this.professionalId(),
      name: this.form.value.name ?? '',
      description: this.form.value.description ?? '',
      durationMinutes: Number(this.form.value.durationMinutes),
    };

    const editingId = this.editingId();
    const request$ = editingId
      ? this.itemService.updateItem(editingId, input)
      : this.itemService.createItem(input);

    request$.subscribe({
      next: () => {
        this.reloadItems();
        this.resetForm();
      },
      error: (err: unknown) => this.handleServiceError(err),
    });
  }

  /** Populate the form for editing an existing Item, retaining its values. */
  edit(item: Item): void {
    this.errorMessage.set(null);
    this.editingId.set(item.id);
    this.form.setValue({
      name: item.name,
      description: item.description,
      durationMinutes: item.durationMinutes,
    });
  }

  /** Delete an Item and refresh the list on success. */
  delete(item: Item): void {
    this.errorMessage.set(null);
    this.itemService.deleteItem(item.id, this.professionalId()).subscribe({
      next: () => {
        // If the item under edit was deleted, exit edit mode.
        if (this.editingId() === item.id) {
          this.resetForm();
        }
        this.reloadItems();
      },
      error: (err: unknown) => this.handleServiceError(err),
    });
  }

  /** Cancel the current edit and clear the form. */
  cancelEdit(): void {
    this.resetForm();
  }

  /** Reset the form to its pristine create state. */
  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '', durationMinutes: null });
  }

  /**
   * Map a service error to the UI: mark the offending control invalid with a
   * field-specific error when the message identifies a field, otherwise show a
   * general error (e.g. "Item not found"). Entered values are always retained.
   */
  private handleServiceError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);

    if (/name|nombre/i.test(message)) {
      this.form.get('name')?.setErrors({ server: message });
    } else if (/description|descripci[oó]n/i.test(message)) {
      this.form.get('description')?.setErrors({ server: message });
    } else if (/duration|duraci[oó]n/i.test(message)) {
      this.form.get('durationMinutes')?.setErrors({ server: message });
    }

    // Always surface the raw message (covers not-found and any field message).
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

  /** Field-specific error text for the duration control. */
  durationError(): string | null {
    const control = this.form.get('durationMinutes');
    if (!control || !(control.touched || control.dirty) || control.valid) {
      return null;
    }
    if (control.hasError('server')) {
      return control.getError('server');
    }
    return `La duración debe ser un número entero entre ${DURATION_MIN} y ${DURATION_MAX} minutos`;
  }
}

/** Validator ensuring the control value is an integer (rejects decimals). */
function integerValidator(control: {
  value: unknown;
}): { integer: true } | null {
  const value = control.value;
  if (value === null || value === '' || value === undefined) {
    return null; // required handles emptiness
  }
  const num = Number(value);
  return Number.isInteger(num) ? null : { integer: true };
}
