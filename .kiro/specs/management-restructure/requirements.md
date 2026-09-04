# Requirements Document

## Introduction

This feature bundles four related changes in the Sora Sport Angular application, all revolving around navigation and the management area. The changes are: (1) hiding the Store/marketplace navigation entry, (2) adding search to the Convocatorias section, (3) introducing a professional Task and Item management area reusing the existing `/management` route, and (4) moving the current athlete-facing management content to a new `/control-center` route for athletes.

The feature establishes a bidirectional flow: professionals define reusable Items, compose them into Tasks, assign Tasks to athletes, and view athlete progress; athletes activate assigned Tasks as plans and check off completed Items, which is reflected back to the professional.

All persistence uses the existing in-memory mock-data services. Per the project constraint, every identifier introduced by this feature (route paths, model and interface names, file and folder names, variable names) MUST be in English.

## Glossary

- **App**: The Sora Sport Angular single-page application.
- **Navigation_Component**: The `LayoutComponent` that renders the desktop sidebar navigation (`navItems`) and the mobile bottom navigation (`bottomNavItems`).
- **Router**: The Angular router configured in `app.routes.ts`.
- **Non_Athlete_Role**: Any `UserRole` value other than `athlete`; specifically `health-professional`, `coach`, `institution`, or `management`.
- **Professional**: A signed-in user whose role is a Non_Athlete_Role.
- **Athlete**: A signed-in user whose role is `athlete`.
- **Convocatorias_Component**: The component at `src/app/features/convocatorias` that displays the list of Convocatoria records.
- **Convocatoria**: An existing model with fields `publisherName`, `publisherRole`, `discipline`, `location`, `type`, `title`, `description`, and others.
- **Management_Area**: The content hosted at the `/management` route, redefined by this feature to serve Professionals.
- **Control_Center**: The new area at the `/control-center` route that serves Athletes.
- **Item**: A reusable building block defined by a Professional, having a name, a description, a duration, and optional additional attributes.
- **Item_Store**: The in-memory mock-data service that persists Item records for the current session.
- **Task**: A named unit of work with a name, a description, and an ordered list of Items, created by a Professional.
- **Task_Store**: The in-memory mock-data service that persists Task records for the current session.
- **Task_Assignment**: A record linking a Task to a specific Athlete, created when a Professional assigns a Task.
- **Assignment_Method**: The mechanism a Professional uses to assign a Task; one of direct assignment, message-based assignment, or bulk assignment.
- **Plan**: A Task_Assignment as viewed by the Athlete; the Athlete activates a Plan and checks off its Items.
- **Item_Completion**: A record indicating that an Athlete has checked off a specific Item within an assigned Task.
- **Search_Query**: The text a user enters to filter the Convocatoria list.
- **Active_State_Indicator**: A visible marker displayed on the active Plan that distinguishes it from all inactive Plans.

## Requirements

### Requirement 1: Hide the Store from navigation

**User Story:** As a product owner, I want the Store/marketplace entry hidden from all navigation, so that users do not access an unfinished area while the route remains available for future work.

#### Acceptance Criteria

1. WHEN the desktop sidebar navigation renders, THE Navigation_Component SHALL exclude the marketplace entry from its list of navigation items.
2. WHEN the mobile bottom navigation renders, THE Navigation_Component SHALL exclude the marketplace entry from its list of navigation items.
3. THE Router SHALL retain the `marketplace` route definition such that direct navigation to the `/marketplace` route resolves to its component.
4. THE Navigation_Component SHALL render zero visible controls (links, buttons, icons, or menu items) that navigate to the `/marketplace` route across all viewport widths.
5. IF a user navigates directly to the `/marketplace` route via URL, THEN THE Router SHALL resolve the route without redirecting away from it.

### Requirement 2: Search Convocatorias by publisher origin and location

**User Story:** As a user browsing Convocatorias, I want to search by the publishing club/origin and by the location where the Convocatoria takes place, so that I can find relevant opportunities quickly.

#### Acceptance Criteria

1. THE Convocatorias_Component SHALL display a Search_Query input control that accepts between 0 and 100 characters.
2. WHEN a user enters a Search_Query, THE Convocatorias_Component SHALL trim leading and trailing whitespace from the Search_Query before filtering.
3. WHEN a user enters a trimmed Search_Query of at least 1 character, THE Convocatorias_Component SHALL filter the displayed list to open Convocatoria records whose `publisherName` contains the trimmed Search_Query as a substring, matched case-insensitively.
4. WHEN a user enters a trimmed Search_Query of at least 1 character, THE Convocatorias_Component SHALL filter the displayed list to open Convocatoria records whose `location` contains the trimmed Search_Query as a substring, matched case-insensitively.
5. WHEN a trimmed Search_Query matches either `publisherName` or `location`, THE Convocatorias_Component SHALL include the matching open Convocatoria in the displayed list.
6. WHEN the trimmed Search_Query is empty, THE Convocatorias_Component SHALL display all open Convocatoria records.
7. WHEN a user enters a Search_Query, THE Convocatorias_Component SHALL update the displayed list within 1 second of the input change.
8. IF no open Convocatoria record matches the trimmed Search_Query, THEN THE Convocatorias_Component SHALL display an empty-result indicator and retain the entered Search_Query in the input control.

### Requirement 3: Route Professionals and Athletes to distinct areas

**User Story:** As a signed-in user, I want to be taken to the area that matches my role, so that Professionals reach the management workspace and Athletes reach their control center.

#### Acceptance Criteria

1. THE Router SHALL define a `control-center` route that loads the Control_Center.
2. IF a Professional navigates to `/management`, THEN THE App SHALL display the Management_Area.
3. IF an Athlete navigates to `/management`, THEN THE App SHALL redirect the Athlete to `/control-center` within 1 second.
4. IF an Athlete navigates to `/control-center`, THEN THE App SHALL display the Control_Center.
5. IF a Professional navigates to `/control-center`, THEN THE App SHALL redirect the Professional to `/management` within 1 second.
6. THE Navigation_Component SHALL present the management navigation entry as a link to `/management`.
7. IF the signed-in user's role cannot be determined, THEN THE App SHALL route the user to the default landing route and SHALL NOT display the Management_Area or the Control_Center.

### Requirement 4: Manage reusable Items (CRUD)

**User Story:** As a Professional, I want to create, view, edit, and delete reusable Items, so that I can build Tasks from consistent building blocks.

#### Acceptance Criteria

1. WHERE the signed-in user is a Professional, THE Management_Area SHALL display an Items area.
2. WHEN a Professional submits a new Item with a name of 1 to 100 characters, a description of 0 to 500 characters, and a duration between 1 and 1440 minutes, THE Item_Store SHALL persist the Item for the current session and THE Management_Area SHALL display the persisted Item in the Professional's Item list.
3. THE Management_Area SHALL display the list of Items belonging to the signed-in Professional.
4. WHEN a Professional edits an existing Item so that its name is 1 to 100 characters, its description is 0 to 500 characters, and its duration is between 1 and 1440 minutes, THE Item_Store SHALL persist the updated Item values and THE Management_Area SHALL display the updated values.
5. WHEN a Professional deletes an existing Item, THE Item_Store SHALL remove the Item from the Professional's Item list and THE Management_Area SHALL update the displayed list within 2 seconds.
6. IF a Professional submits or edits an Item with a name that is empty or exceeds 100 characters, with a description that exceeds 500 characters, or with a duration outside the range of 1 to 1440 minutes, THEN THE Management_Area SHALL reject the submission, retain the entered values, and display a validation message indicating which field failed.
7. IF a Professional attempts to edit or delete an Item that does not exist in the Professional's Item list, THEN THE Item_Store SHALL reject the operation, leave the Item list unchanged, and THE Management_Area SHALL display an error message indicating the Item was not found.

### Requirement 5: Manage Tasks composed of Items (CRUD)

**User Story:** As a Professional, I want to create, view, edit, and delete Tasks that have a name, a description, and a list of Items, so that I can assemble reusable, well-described plans for Athletes.

#### Acceptance Criteria

1. WHERE the signed-in user is a Professional, THE Management_Area SHALL display a Tasks area listing the Professional's own Tasks.
2. WHEN a Professional creates a Task with a name between 1 and 100 characters, a description between 0 and 1000 characters, and an ordered list of 1 to 100 Items, THE Task_Store SHALL persist the Task with its name, description, and ordered list of Items for the current session and preserve the Item order as arranged by the Professional.
3. WHEN a Professional types 1 or more characters into the Task Item selector, THE Management_Area SHALL display up to 10 Item suggestions from the Professional's own Items whose name contains the typed text, matched case-insensitively.
4. WHEN a Professional types text into the Task Item selector and no Item name contains the typed text, THE Management_Area SHALL display an indication that no matching Items were found.
5. WHEN a Professional selects a suggested Item, THE Management_Area SHALL append the selected Item to the end of the ordered Item list of the Task being built.
6. WHEN a Professional edits an existing Task, THE Task_Store SHALL persist the updated Task name, description, and ordered Item list for the current session.
7. WHEN a Professional deletes an existing Task, THE Task_Store SHALL remove the Task from the Professional's Task list and THE Management_Area SHALL no longer display the removed Task.
8. IF a Professional submits a Task without a name, or with a name shorter than 1 character or longer than 100 characters, THEN THE Management_Area SHALL reject the submission, retain the entered Task values, and display a validation message indicating the name is required and must be between 1 and 100 characters.
9. IF a Professional submits a Task with a description longer than 1000 characters, THEN THE Management_Area SHALL reject the submission, retain the entered Task values, and display a validation message indicating the description must not exceed 1000 characters.
10. IF a Professional submits a Task with no Items, THEN THE Management_Area SHALL reject the submission, retain the entered Task values, and display a validation message indicating at least one Item is required.

### Requirement 6: Assign Tasks to Athletes through multiple methods

**User Story:** As a Professional, I want to assign a Task to one or more Athletes through the method I prefer, so that I can distribute plans in the way that fits my workflow.

#### Acceptance Criteria

1. WHEN a Professional assigns a Task to an Athlete through direct assignment, THE Task_Store SHALL create one Task_Assignment linking the Task to the Athlete.
2. WHEN a Professional assigns a Task to an Athlete through a message, THE Task_Store SHALL create one Task_Assignment linking the Task to the Athlete.
3. WHEN a Professional assigns a Task to a selected set of between 1 and 500 Athletes through bulk assignment, THE Task_Store SHALL create one Task_Assignment for each selected Athlete.
4. THE Management_Area SHALL present the direct assignment, message-based assignment, and bulk assignment methods as available options.
5. IF a Professional attempts to assign a Task without selecting at least one Athlete, THEN THE Management_Area SHALL reject the assignment, retain the current selection state, and display a validation message indicating that at least one Athlete must be selected within 2 seconds of the attempt.
6. IF a Professional attempts to assign a Task through bulk assignment to more than 500 Athletes, THEN THE Management_Area SHALL reject the assignment, retain the current selection state, and display a validation message indicating the maximum number of Athletes allowed per bulk assignment.
7. IF a Task_Assignment already exists linking the Task to a selected Athlete, THEN THE Task_Store SHALL skip creation of a duplicate Task_Assignment for that Athlete and retain the existing Task_Assignment.
8. IF creation of one or more Task_Assignments fails during a bulk assignment, THEN THE Task_Store SHALL roll back all Task_Assignments created in that bulk assignment and THE Management_Area SHALL display an error message indicating that the bulk assignment did not complete.

### Requirement 7: View assigned Athlete progress

**User Story:** As a Professional, I want to see which Items each assigned Athlete has completed, so that I can track progress on the plans I assigned.

#### Acceptance Criteria

1. WHERE a Professional has created a Task_Assignment, THE Management_Area SHALL display the assigned Athlete's identifying name for that Task_Assignment.
2. WHEN a Professional opens a Task_Assignment, THE Management_Area SHALL display, for each Item in the assigned Task, a completion state of either "completed" or "not completed".
3. WHEN an Athlete records an Item_Completion for an assigned Task, THE Management_Area SHALL display that Item with completion state "completed" for the corresponding Task_Assignment within 5 seconds of the next Management_Area data refresh.
4. IF a Task_Assignment has no assigned Athlete, THEN THE Management_Area SHALL display an indication that no Athlete is assigned and SHALL display every Item with completion state "not completed".
5. IF the completion progress cannot be retrieved for a Task_Assignment, THEN THE Management_Area SHALL display an error indication that progress is unavailable and SHALL NOT display any Item completion state for that Task_Assignment.

### Requirement 8: Athlete Control Center with recommendation tabs

**User Story:** As an Athlete, I want to see my recommendation lists organized by type in the Control Center, so that I retain the view I previously used in the management area.

#### Acceptance Criteria

1. WHERE the signed-in user is an Athlete, THE Control_Center SHALL display recommendation lists grouped by recommendation type, showing exactly one group per distinct recommendation type that has at least one recommendation belonging to the signed-in Athlete.
2. WHERE the signed-in user is an Athlete, THE Control_Center SHALL display only the recommendations for which the signed-in Athlete is the owner, and SHALL exclude recommendations belonging to any other Athlete.
3. WHEN the Control_Center loads recommendation lists for the signed-in Athlete, THE Control_Center SHALL order the recommendations within each type group from most recently created to least recently created.
4. IF the signed-in Athlete has no recommendations of a given recommendation type, THEN THE Control_Center SHALL omit that recommendation type group from the display.
5. IF the request to retrieve the signed-in Athlete's recommendations fails, THEN THE Control_Center SHALL retain any previously displayed recommendation data unchanged and SHALL display an indication that the recommendations could not be loaded.

### Requirement 9: Activate a Plan

**User Story:** As an Athlete, I want to set a Plan as active, so that I can focus on the plan I am currently following.

#### Acceptance Criteria

1. WHEN an Athlete sets a Plan as active, THE Control_Center SHALL mark that Plan as the active Plan for the Athlete and record the activation.
2. WHILE a Plan is active, THE Control_Center SHALL display a visible active-state indicator on that Plan that distinguishes it from all inactive Plans.
3. THE Control_Center SHALL maintain at most one active Plan per Athlete at any time.
4. WHEN an Athlete sets a different Plan as active, THE Control_Center SHALL mark the newly selected Plan as active and clear the active state of the previously active Plan within 2 seconds.
5. IF an Athlete sets a Plan as active while that Plan is already the active Plan, THEN THE Control_Center SHALL retain that Plan as active and leave the active state unchanged.
6. IF setting a Plan as active fails, THEN THE Control_Center SHALL retain the previously active Plan as active, make no change to any Plan's active state, and present an error indication informing the Athlete that the activation did not complete.

### Requirement 10: Check off completed Items and reflect progress

**User Story:** As an Athlete, I want to check off the Items I have completed within a Plan, so that my Professional can see my progress.

#### Acceptance Criteria

1. WHEN an Athlete checks off an Item within an assigned Task, THE Control_Center SHALL record an Item_Completion for that Item and Task_Assignment within 2 seconds.
2. WHEN an Athlete clears a previously checked Item within an assigned Task, THE Control_Center SHALL remove the corresponding Item_Completion within 2 seconds.
3. WHEN an assigned Task is displayed, THE Control_Center SHALL show each Item within that Task as either completed or not completed, reflecting the current recorded Item_Completion state.
4. WHEN an Athlete records an Item_Completion, THE Task_Store SHALL persist the Item_Completion for the current session so that the assigning Professional can view it.
5. IF persisting or removing an Item_Completion fails, THEN THE Control_Center SHALL retain the Item's prior completion state and display an error indication informing the Athlete that the change was not saved.
6. IF an Athlete attempts to check off or clear an Item within a Task that is not assigned to that Athlete, THEN THE Control_Center SHALL reject the change and record no Item_Completion.
