/** A reusable building block defined by a professional. */
export interface Item {
  id: string;
  professionalId: string;      // owner
  name: string;                // 1..100 chars
  description: string;         // 0..500 chars
  durationMinutes: number;     // 1..1440
  createdAt: string;           // ISO timestamp
}

/** Input payload for create/update (id and createdAt assigned by the store). */
export interface ItemInput {
  professionalId: string;
  name: string;                // 1..100 chars
  description: string;         // 0..500 chars
  durationMinutes: number;     // 1..1440
}

/** A named unit of work composed of an ordered list of Items. */
export interface Task {
  id: string;
  professionalId: string;      // owner
  name: string;                // 1..100 chars
  description: string;         // 0..1000 chars
  itemIds: string[];           // ordered, length 1..100, references Item.id
  createdAt: string;           // ISO timestamp
}

export interface TaskInput {
  professionalId: string;
  name: string;                // 1..100 chars
  description: string;         // 0..1000 chars
  itemIds: string[];           // ordered, length 1..100, references Item.id
}

/** How a professional assigned a task to an athlete. */
export enum AssignmentMethod {
  Direct = 'direct',
  Message = 'message',
  // Bulk assignment passes athleteIds (length 1..500) to the store; the bound
  // is enforced by MockTaskService and is not stored on a model field.
  Bulk = 'bulk',
}

/** Links a Task to a specific Athlete. */
export interface TaskAssignment {
  id: string;
  taskId: string;
  athleteId: string;
  assignedAt: string;          // ISO timestamp
  method: AssignmentMethod;
  active: boolean;             // true when this is the athlete's active Plan
}

/** Records that an athlete checked off a specific Item within an assignment. */
export interface ItemCompletion {
  id: string;
  taskAssignmentId: string;
  itemId: string;
  athleteId: string;
  completedAt: string;         // ISO timestamp
}

/** Result of an assignment operation. */
export interface AssignmentResult {
  created: TaskAssignment[];   // newly created assignments
  skipped: string[];           // athleteIds skipped as duplicates
  // Bulk assignments accept an athleteIds list of length 1..500.
}

/** Per-item completion state for the professional progress view. */
export interface ItemProgress {
  itemId: string;
  itemName: string;
  completed: boolean;
}

export interface AssignmentProgress {
  assignmentId: string;
  athleteId: string;
  athleteName: string | null;  // null when no athlete assigned
  items: ItemProgress[];
  // Progress summary fields, populated by MockTaskService.getProgress. Optional
  // so existing callers/tests that build AssignmentProgress literals without a
  // summary keep compiling; consumers fall back to deriving from `items`.
  completedCount?: number;     // number of items completed
  totalCount?: number;         // total number of items in the task
  percentage?: number;         // 0..100, rounded; 0 when there are no items
}
