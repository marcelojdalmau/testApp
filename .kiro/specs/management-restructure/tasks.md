# Implementation Plan: Management Restructure

## Overview

This plan implements the management-restructure feature for the Sora Sport Angular 22 app (standalone components, `signal()`, `inject()`, Angular Material, lazy-loaded routes, in-memory mock-data services). Work is ordered so each task builds on the previous: data models first, then the session-persistent mock stores (`MockItemService`, `MockTaskService`), then `CurrentUserService` and the role guards, then routing and navigation changes, then the Convocatorias search, then the professional UI (Items, Tasks, Assignment, Progress), and finally the athlete Control Center (recommendation tabs migration, plan activation, item check-off).

Property-based tests use `fast-check` in `*.property.spec.ts` files, run a minimum of 100 iterations, and are tagged `Feature: management-restructure, Property N: ...`. Example/edge/`fakeAsync` tests use Karma/Jasmine. All identifiers are in English. New components use `ChangeDetectionStrategy.OnPush`.

## Tasks

- [x] 1. Define management data models
  - Create `src/app/core/models/management.model.ts` with the `Item`, `ItemInput`, `Task`, `TaskInput`, `TaskAssignment`, `ItemCompletion`, `AssignmentResult`, `ItemProgress`, and `AssignmentProgress` interfaces and the `AssignmentMethod` enum (`Direct`, `Message`, `Bulk`) exactly as specified in the design Data Models section (English identifiers, ISO timestamp fields, ordered `itemIds`).
  - Document the validation bounds (name 1–100, description 0–500/0–1000, duration 1–1440, itemIds 1–100, bulk athleteIds 1–500) as comments alongside the fields they constrain.
  - _Requirements: 4.2, 5.2, 6.3, 7.2_

- [x] 2. Implement `MockItemService` (session-persistent Item store)
  - [x] 2.1 Create `MockItemService` with a mutable signal-backed store
    - Create `src/app/mock-data/services/mock-item.service.ts` as an injectable service holding an internal signal-backed array of `Item`.
    - Implement `getItemsForProfessional(professionalId)` returning `Observable<Item[]>` via `of(...)`, filtering strictly by owner `professionalId`.
    - Implement `createItem(input)`, `updateItem(id, input)`, and `deleteItem(id)` returning `Observable<Item>`/`Observable<void>`; assign `id`/`createdAt` in the store on create; re-validate bounds and ownership defensively and reject via `throwError` when the id is not owned/not found or a bound is violated.
    - Implement `searchItemsByName(professionalId, text, limit = 10)` returning at most `limit` owner-only Items whose `name` contains `text` case-insensitively.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.3_

  - [x] 2.2 Write property test for Item CRUD lifecycle and ownership round-trip
    - **Property 3: Item CRUD lifecycle and ownership round-trip**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
    - Fresh service per run, `numRuns >= 100`, tagged `Feature: management-restructure, Property 3: ...`.

  - [x] 2.3 Write property test for rejected invalid/absent Item operations
    - **Property 4: Invalid or absent Item operations are rejected without side effects**
    - **Validates: Requirements 4.6, 4.7, 5.8, 5.9, 5.10**
    - Assert the store's Item set is unchanged after each rejected create/update/delete; `numRuns >= 100`; tagged.

  - [x] 2.4 Write property test for Item autocomplete suggestions
    - **Property 6: Item autocomplete suggestions**
    - **Validates: Requirements 5.3**
    - Assert `searchItemsByName` returns <= 10 owner-only Items each with a case-insensitive name-contains match; `numRuns >= 100`; tagged.

- [x] 3. Implement `MockTaskService` (Tasks, TaskAssignments, ItemCompletions)
  - [x] 3.1 Create `MockTaskService` with Task CRUD
    - Create `src/app/mock-data/services/mock-task.service.ts` as an injectable service with signal-backed arrays for `Task`, `TaskAssignment`, and `ItemCompletion`.
    - Implement `getTasksForProfessional(professionalId)`, `createTask(input)`, `updateTask(id, input)`, `deleteTask(id)`; persist name, description, and the ordered `itemIds` exactly as provided; re-validate bounds (name 1–100, description 0–1000, itemIds 1–100) and reject via `throwError` on violation or not-found.
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 3.2 Write property test for Task persistence preserving ordered items
    - **Property 5: Task persistence preserves ordered items**
    - **Validates: Requirements 5.2, 5.5, 5.6, 5.7**
    - Assert read-back `itemIds` match input contents and order, and that appending an item lands at the end leaving the prefix unchanged; `numRuns >= 100`; tagged.

  - [x] 3.3 Implement Task assignment (direct, message, bulk) with dedup and rollback
    - Implement `assignTask(taskId, athleteIds, method)` returning `Observable<AssignmentResult>`; create exactly one `TaskAssignment` per not-yet-assigned athlete with correct `taskId`/`athleteId`/`method`; skip existing `(taskId, athleteId)` pairs into `AssignmentResult.skipped`.
    - Enforce bulk bound 1–500; make bulk all-or-nothing (stage then commit, discard staged set and `throwError` on any failure).
    - Implement `getAssignmentsForProfessional(professionalId)` and `getAssignmentsForAthlete(athleteId)`.
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8_

  - [x] 3.4 Write property test for one TaskAssignment per new athlete
    - **Property 7: Assignment creates exactly one TaskAssignment per new athlete**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - `numRuns >= 100`; tagged.

  - [x] 3.5 Write property test for no duplicate TaskAssignment
    - **Property 8: No duplicate TaskAssignment for the same task and athlete**
    - **Validates: Requirements 6.7**
    - Assert no two records share a `(taskId, athleteId)` pair over arbitrary assignment sequences; `numRuns >= 100`; tagged.

  - [x] 3.6 Write property test for bulk assignment atomicity and rollback
    - **Property 9: Bulk assignment atomicity and rollback**
    - **Validates: Requirements 6.8**
    - Inject a creation failure and assert the store equals its pre-operation state; `numRuns >= 100`; tagged.

  - [x] 3.7 Implement plan activation and item completion
    - Implement `activatePlan(athleteId, assignmentId)` enforcing at most one active plan per athlete (clear the previously active one; re-activating the active plan is a no-op) and `getActivePlan(athleteId)`.
    - Implement `setItemCompletion(assignmentId, itemId, completed, athleteId)` creating/removing an `ItemCompletion` only when the assignment belongs to that athlete; reject otherwise with no record written. Implement `getCompletions(assignmentId)` and `getProgress(assignmentId)` returning `AssignmentProgress` (athlete name, per-item completed state; `athleteName` null when unassigned).
    - _Requirements: 7.2, 7.3, 7.4, 9.1, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.6_

  - [x] 3.8 Write property test for at most one active plan per athlete
    - **Property 10: At most one active plan per athlete**
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5**
    - Over arbitrary `activatePlan` sequences assert at most one active plan at every step; `numRuns >= 100`; tagged.

  - [x] 3.9 Write property test for item completion bidirectional round-trip
    - **Property 11: Item completion bidirectional round-trip**
    - **Validates: Requirements 7.2, 7.3, 10.1, 10.2, 10.3, 10.4**
    - Check off then clear an item and assert `getProgress` returns to its prior state; `numRuns >= 100`; tagged.

  - [x] 3.10 Write property test for completion rejected for a non-assigned athlete
    - **Property 12: Completion rejected for a non-assigned athlete**
    - **Validates: Requirements 10.6**
    - Assert `setItemCompletion` records nothing when the assignment's `athleteId` differs; `numRuns >= 100`; tagged.

- [x] 4. Checkpoint - Ensure all store tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement `CurrentUserService` and role guards
  - [x] 5.1 Create `CurrentUserService`
    - Create `src/app/core/services/current-user.service.ts` exposing `readonly userId: Signal<string>` and `readonly role: Signal<UserRole | 'undetermined'>`.
    - Resolve identity/role from `AuthService` (token `userRoles()` with a documented fallback), where `athlete` is the athlete role, `health-professional`/`coach`/`institution`/`management` are Non_Athlete_Roles (Professional), and empty/unresolved → undetermined.
    - _Requirements: 3.7_

  - [x] 5.2 Create `professionalGuard` and `athleteGuard`
    - Create `src/app/core/guards/professional.guard.ts` and `src/app/core/guards/athlete.guard.ts` as functional `CanActivateFn` using `inject(CurrentUserService)` and `inject(Router)`, deciding from the `role` signal.
    - `professionalGuard`: allow Non_Athlete_Roles, redirect `athlete` to `/control-center`, redirect undetermined to `/feed`. `athleteGuard`: allow `athlete`, redirect Non_Athlete_Roles to `/management`, redirect undetermined to `/feed`.
    - _Requirements: 3.2, 3.3, 3.5, 3.7_

  - [x] 5.3 Write property test for role-guard routing
    - **Property 2: Role-guard routing**
    - **Validates: Requirements 3.2, 3.3, 3.5, 3.7**
    - Arbitrary over all `UserRole` values including undetermined; assert allow/redirect decisions for both guards; `numRuns >= 100`; tagged.

- [x] 6. Wire routing and navigation
  - [x] 6.1 Update `app.routes.ts` for guards and control-center
    - Add `canActivate: [professionalGuard]` to the existing `management` route; add the lazy `control-center` route with `canActivate: [athleteGuard]` loading `ControlCenterComponent`.
    - Keep the `marketplace` route unchanged with no redirect or role guard away from it.
    - _Requirements: 3.1, 3.2, 3.4, 1.3, 1.5_

  - [x] 6.2 Remove marketplace entries from `LayoutComponent` navigation
    - In `src/app/core/layout/layout.component.ts` remove the `/marketplace` entry from both `navItems` and `bottomNavItems`; leave the management entry as a `/management` link. Ensure no template control navigates to `/marketplace`.
    - _Requirements: 1.1, 1.2, 1.4, 3.6_

  - [x] 6.3 Write example tests for navigation and routing config
    - Assert `navItems` and `bottomNavItems` contain no `/marketplace` entry and the management entry routes to `/management` (1.1, 1.2, 1.4, 3.6).
    - Assert the `marketplace` route is present with no redirect/role guard away from it, and the `control-center` route exists with `athleteGuard` (1.3, 1.5, 3.1).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.6_

- [x] 7. Implement Convocatorias search
  - [x] 7.1 Add search filtering to `ConvocatoriasComponent`
    - In `src/app/features/convocatorias/` add a `searchQuery` signal bound to a Material input (`MatFormFieldModule`, `MatInputModule`) accepting 0–100 chars, debounced 250ms.
    - Store the full open list in an `allConvocatorias` signal and expose a `filteredConvocatorias` computed applying the trimmed, case-insensitive `publisherName OR location` substring filter; show all when trimmed query is empty.
    - Show an empty-result indicator when a present query yields zero matches, retaining the input value.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 7.2 Write property test for the search filter
    - **Property 1: Search filter correctness**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
    - Arbitrary Convocatoria lists with overlapping/random `publisherName`/`location`; `numRuns >= 100`; tagged.

  - [x] 7.3 Write example/edge and fakeAsync tests for search
    - Boundary tests at query length 0/100/101 (2.1); a `fakeAsync` test asserting the list updates within the debounce window (< 1s) (2.7); a no-match test asserting the empty indicator shows and the query is retained (2.8).
    - _Requirements: 2.1, 2.7, 2.8_

- [x] 8. Checkpoint - Ensure guards, routing, and search tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement professional Items management UI
  - [x] 9.1 Build `ItemsManagerComponent`
    - Create `ItemsManagerComponent` (standalone, OnPush, signal-driven) under `src/app/features/management/` with a reactive form (name 1–100, description 0–500, duration 1–1440) calling `MockItemService` create/update/delete and listing the professional's Items.
    - On validation failure or not-found error, retain entered values, mark the offending control invalid, and render a field-specific message; refresh the list within the required bounds after delete.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 9.2 Write example tests for Items validation and error states
    - Test boundary/invalid inputs surface field-specific messages and retain values (4.6); not-found edit/delete shows the not-found message and leaves the list unchanged (4.7).
    - _Requirements: 4.6, 4.7_

- [x] 10. Implement professional Tasks management UI
  - [x] 10.1 Build `TasksManagerComponent` with autocomplete
    - Create `TasksManagerComponent` (standalone, OnPush) under `src/app/features/management/` with a reactive form (name 1–100, description 0–1000, items 1–100) and a `mat-autocomplete` Item selector fed by `searchItemsByName` (<=10, case-insensitive, own Items); selecting a suggestion appends to the ordered `itemIds`.
    - Show a "no matching items" indication when typed text matches no Item; enforce validations with field-specific messages and retained values; call `MockTaskService` create/update/delete.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 10.2 Write example test for autocomplete no-match
    - Typing text with no matching Item shows the "no matching items" indication (5.4).
    - _Requirements: 5.4_

- [x] 11. Implement Task assignment UI
  - [x] 11.1 Build `TaskAssignmentComponent`
    - Create `TaskAssignmentComponent` (standalone, OnPush) offering direct, message-based, and bulk (1–500) methods with athlete selection; call `MockTaskService.assignTask` and report `AssignmentResult.skipped` counts.
    - Reject empty selection with a validation message within 2s retaining selection; reject bulk > 500 with the max-athletes message; show a "bulk assignment did not complete" error on rollback.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 11.2 Write example tests for assignment UI
    - Assert all three methods offered (6.4); empty selection rejected with a message within 2s (6.5); bulk boundary 500 accepted and 501 rejected (6.6).
    - _Requirements: 6.4, 6.5, 6.6_

- [x] 12. Implement assignment progress view
  - [x] 12.1 Build `AssignmentProgressComponent`
    - Create `AssignmentProgressComponent` (standalone, OnPush) showing the assigned athlete's name and per-item completed/not-completed state via `MockTaskService.getProgress`.
    - When no athlete is assigned, show the no-athlete indication with all items not-completed; on `getProgress` error show a "progress unavailable" indication and render no item states; reflect athlete completions on data refresh.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 12.2 Write example tests for progress rendering
    - Athlete name shown (7.1); no-athlete assignment shows all items not-completed with indication (7.4); `getProgress` failure shows the unavailable state (7.5).
    - _Requirements: 7.1, 7.4, 7.5_

- [x] 13. Compose the professional workspace
  - [x] 13.1 Repurpose `ManagementComponent` as the professional shell
    - Repurpose `src/app/features/management/management.component.ts` to compose `ItemsManagerComponent`, `TasksManagerComponent`, `TaskAssignmentComponent`, and `AssignmentProgressComponent` using `MatTabsModule`, resolving the professional id from `CurrentUserService`. Remove the migrated athlete recommendation logic (moved in task 14).
    - _Requirements: 3.2, 4.1, 5.1_

- [x] 14. Checkpoint - Ensure professional UI tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement athlete Control Center
  - [x] 15.1 Build `RecommendationTabsComponent` (migrated from management)
    - Create `RecommendationTabsComponent` under `src/app/features/control-center/`, migrating the `getTypeLabel`/`getRecommendationIcon` helpers and grouping logic from the old `ManagementComponent`.
    - Show owner-only recommendations grouped by type (one group per distinct present type, omit absent types), ordered most-recent-first; on load failure retain previously displayed data and show a load-error indication.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 15.2 Write property test for recommendation grouping
    - **Property 13: Control Center recommendations are owner-only, grouped, and most-recent-first**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - `numRuns >= 100`; tagged.

  - [x] 15.3 Write example test for recommendation load failure
    - A failing load retains previously displayed recommendations and shows an error (8.5).
    - _Requirements: 8.5_

  - [x] 15.4 Build `PlanListComponent` with activation and item check-off
    - Create `PlanListComponent` under `src/app/features/control-center/` reading `getAssignmentsForAthlete`; render an active-state indicator on the active plan (none on inactive plans) and per-item checkboxes.
    - Call `activatePlan` on activation and `setItemCompletion` on check/clear; on activation failure retain the previous active plan and show an error; on completion failure revert the checkbox and show a "change not saved" message.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 15.5 Write example tests for active indicator and completion/activation failures
    - Active plan renders the indicator and inactive plans do not (9.2); injected activation failure retains the previous active plan and shows an error (9.6); injected completion persistence failure retains prior state and shows a "not saved" message (10.5).
    - _Requirements: 9.2, 9.6, 10.5_

  - [x] 15.6 Build `ControlCenterComponent` shell
    - Create `ControlCenterComponent` under `src/app/features/control-center/` composing `RecommendationTabsComponent` and `PlanListComponent`, resolving the athlete id from `CurrentUserService`. Ensure it is the target of the lazy `control-center` route from task 6.1.
    - _Requirements: 3.1, 3.4, 8.1_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Optional polish
  - [x] 17.1 Add loading and empty-state affordances across professional and Control Center views for a smoother experience.
    - _Requirements: 7.5, 8.5_
  - [x] 17.2 Add ARIA labels and keyboard navigation for the autocomplete, tabs, and plan checkboxes.
    - _Requirements: 5.3, 8.1_

## Notes

- Tasks marked with `*` are optional (test sub-tasks and polish) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Property tests (Properties 1–13) instantiate a fresh service/state per run, use `numRuns >= 100`, and carry the `Feature: management-restructure, Property N: ...` tag.
- Example/edge/`fakeAsync` tests cover UI wiring, boundaries, timing, and error-toast behavior per the design Testing Strategy.
- Each task references specific requirement clauses (and property numbers where relevant) for traceability.
- Checkpoints ensure incremental validation at natural boundaries (stores, guards/routing/search, professional UI, full feature).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.1", "5.2"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.3", "6.1", "6.2"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "3.7", "6.3", "7.1"] },
    { "id": 5, "tasks": ["3.8", "3.9", "3.10", "7.2", "7.3", "9.1", "10.1", "11.1", "12.1", "15.1", "15.4"] },
    { "id": 6, "tasks": ["9.2", "10.2", "11.2", "12.2", "15.2", "15.3", "15.5", "13.1", "15.6"] },
    { "id": 7, "tasks": ["17.1", "17.2"] }
  ]
}
```
