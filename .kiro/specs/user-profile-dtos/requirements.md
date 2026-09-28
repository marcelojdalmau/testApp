# Requirements Document

## Introduction

This feature defines a single, extensible TypeScript data-shape (DTO) for a user "Profile" in the Sora Sport application (Angular + TypeScript). The source of truth is a partially completed list (originally exported from Excel/CSV) whose "variable name" column was left empty.

The central goal of this spec is to assign clear, English variable names to every field in that list and to model them as a single `UserProfileDto` interface composed of small, nested block interfaces (one block per profile persona type, one small interface per nested array).

Scope boundaries agreed with the user:
- This DTO is a NEW artifact for mocking/testing only. It must NOT replace or merge with the existing models (`UserProfile`, `AthleteProfile`, `Club`, etc.). It is expected to be deleted in the future.
- The design contains only data shapes: interfaces, field names, and types. No logic, no validation, no classes.
- Simplicity and extensibility are the priority. The list is not final; several blocks are known to be incomplete. The structure must accept new fields later without breaking.
- Fields marked as "id" (other than the entity's own `id`) are foreign keys to backend catalogs that are NOT yet defined. They are typed as `string` (or `string[]`), with an inline comment noting the pending backend catalog.
- Fields marked as "file" represent uploaded attachments.
- Sport-dependent lists (categories, positions) are modeled as interfaces/types only; real mock loading comes later.

## Glossary

- **UserProfileDto**: The single root data-shape interface that groups all profile data for any persona type. Located in `src/app/core/models/`.
- **Profile Block**: A named sub-interface grouping fields for one persona type (e.g., natural person, health professional, athlete, club, manager, tutor, club worker).
- **Catalog FK**: A field that references an entry in a backend-managed catalog/list not yet defined. Typed as `string` or `string[]`, distinct from the entity's own `id`.
- **Entity Id**: The single `id: string` field identifying the profile entity itself (the classic primary identifier).
- **Attachment**: A field representing an uploaded file (e.g., ID-card photo, diploma). Modeled as a file-reference type.
- **Nested Array Block**: A small interface describing one element of an array within a profile block (e.g., a single study, a single language, one prior job).
- **Pending Field**: A field whose type is not defined in the source list; it is still declared, given the most reasonable type, and marked as pending.
- **Persona Type**: One of the profile categories detected in the source list: Natural Person, Health Professional, Athlete, Club, Manager, Tutor, Club Worker.

## Requirements

### Requirement 1: Single Root User Profile DTO

**User Story:** As a frontend developer, I want a single root DTO that groups all profile data, so that I can mock any persona type without juggling multiple domain DTOs.

#### Acceptance Criteria

1. THE UserProfileDto SHALL be defined as exactly one TypeScript interface declaration located within the `src/app/core/models/` directory.
2. THE UserProfileDto SHALL expose each Persona Type from the source list as a Profile Block property marked optional using the TypeScript `?` modifier.
3. THE UserProfileDto SHALL declare all identifiers, field names, and comments using English words only, with no non-English identifiers.
4. WHERE the source list leaves a field type undefined, THE UserProfileDto SHALL declare the field with a concrete TypeScript type and an inline comment containing the word "pending".
5. THE UserProfileDto SHALL contain zero method declarations, zero executable statements, and zero validation logic.

### Requirement 2: Non-Interference With Existing Models

**User Story:** As a maintainer, I want the new DTO isolated from existing models, so that current code keeps working and the DTO can be deleted later without side effects.

#### Acceptance Criteria

1. THE UserProfileDto SHALL use type names that do not collide with existing exported type names in `src/app/core/models/`.
2. THE UserProfileDto SHALL be declared in a new file within `src/app/core/models/`.
3. THE UserProfileDto SHALL NOT modify, extend, or import the existing `UserProfile`, `AthleteProfile`, or `Club` types.

### Requirement 3: Identifier and Foreign-Key Typing

**User Story:** As a developer, I want consistent id typing rules, so that entity identifiers and backend catalog references are unambiguous.

#### Acceptance Criteria

1. THE UserProfileDto SHALL declare exactly one Entity Id field named `id` of type `string`.
2. WHERE a source field is marked as "id" and is not the Entity Id, THE UserProfileDto SHALL type the field as `string` and mark the field with an inline comment naming the pending backend catalog it references.
3. WHERE a source field is marked as "array id", THE UserProfileDto SHALL type the field as `string[]` and mark the field with an inline comment naming the pending backend catalog it references.
4. THE UserProfileDto SHALL name each Catalog FK field so that its final segment is `Id` for a single reference or `Ids` for a multiple reference.
5. IF a Catalog FK field lacks the required `Id` or `Ids` suffix, THEN THE UserProfileDto SHALL rename the field to include the correct suffix.

### Requirement 4: Attachment Fields

**User Story:** As a developer, I want file attachments modeled consistently, so that document uploads (ID photo, diplomas, certificates) share one shape.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model each "file" field using a single shared Attachment type.
2. THE UserProfileDto SHALL mark the ID-card verification photo as a required Attachment within the common profile block.
3. WHERE a source field represents an uploaded document, THE UserProfileDto SHALL type the field as the shared Attachment type.

### Requirement 5: Common Profile Data Block

**User Story:** As a developer, I want the common profile fields modeled in one block, so that shared identity and contact data is reused across persona types.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a common profile block containing the Entity Id, marketplace-visibility option, profile photo, email, first name, last name, birth date, identity-document number, document-type Catalog FK, ID-card verification Attachment, nationality Catalog FK, sex Catalog FK, address, postal code, city, province, country, phone, and person-type Catalog FK.
2. THE common profile block SHALL mark profile photo, email, first name, last name, birth date, identity-document number, document-type, ID-card verification Attachment, nationality, sex, and person-type as required.
3. THE common profile block SHALL type birth date as a date value.
4. WHERE a common field is required only for marketplace visibility, THE common profile block SHALL declare the field as optional and mark the marketplace dependency with an inline comment.

### Requirement 6: Natural Person Block

**User Story:** As a developer, I want a natural-person block, so that non-professional individual data has a place.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a natural-person block containing sports practiced, hobbies, and an amateur-sports indicator.
2. THE natural-person block SHALL type the amateur-sports indicator as a boolean value.

### Requirement 7: Health Professional Block

**User Story:** As a developer, I want a health-professional block with its nested arrays, so that credential and experience data is captured.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a health-professional block containing a remote-work indicator, profession-type Catalog FK, a licensed indicator, a license Catalog FK, study institution, and graduation date.
2. THE health-professional block SHALL type the remote-work indicator and licensed indicator as boolean values, and SHALL mark the licensed indicator as required.
3. WHERE the licensed indicator is true, THE health-professional block SHALL provide the license Catalog FK, declared as optional with an inline comment describing the conditional dependency.
4. THE health-professional block SHALL model a studies array whose element is a Nested Array Block containing study-level Catalog FK (required), graduation year, obtained degree, average, and a degree Attachment.
5. THE health-professional block SHALL model a languages array whose element is a Nested Array Block containing language, level, institution, graduation year, and a certificate Attachment.
6. THE health-professional block SHALL model a work-experience array whose element is a Nested Array Block containing workplace, start date, end date, a currently-working boolean, reference contact, position, and additional details.
7. THE health-professional block SHALL model a skills array whose element is a Nested Array Block containing skill type and additional details.

### Requirement 8: Athlete Block

**User Story:** As a developer, I want an athlete block with sport-dependent nested arrays, so that per-sport data, prior experience, and competitions are captured.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model an athlete block containing a sports array whose element is a Nested Array Block.
2. THE sport Nested Array Block SHALL contain sport type, personal record, category Catalog FK, natural-position Catalog FK array, level (amateur/elite/professional), current club, and entry date.
3. THE sport Nested Array Block SHALL model a prior-experience array whose element is a Nested Array Block containing club, position Catalog FK array, entry date, exit date, and details.
4. THE sport Nested Array Block SHALL model a competitions array whose element is a Nested Array Block containing tournament, year, tournament position, achievement Catalog FK array, and details.
5. WHERE a field varies by sport (category, position), THE athlete block SHALL type the field as a Catalog FK and mark the sport-dependent nature with an inline comment.

### Requirement 9: Anatomical / Clinical Block

**User Story:** As a developer, I want an anatomical/clinical block, so that physical and medical profile data has a place even while incomplete.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model an anatomical block containing weight, height, blood group, anthropometry, somatotype Catalog FK, clinical history, an injuries array, and medical restrictions.
2. THE anatomical block SHALL declare its fields as optional and SHALL mark the block as incomplete with an inline comment indicating that fields are pending.

### Requirement 10: Club Block

**User Story:** As a developer, I want a club block with its nested arrays, so that club identity, disciplines, and facilities are captured.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a club block containing name, legal name, founding year, location, phone, and social links.
2. THE club block SHALL model a disciplines array whose element is a Nested Array Block containing discipline name and a categories Catalog FK array.
3. THE club block SHALL model a facilities array whose element is a Nested Array Block containing name, type Catalog FK array, location, phone number, and internal details, and SHALL mark the internal details with an inline comment indicating club-internal visibility.

### Requirement 11: Manager Block

**User Story:** As a developer, I want a manager block, so that represented-player data is captured.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a manager block containing represented-player count, main discipline, and a represented-players array.
2. THE represented-players array SHALL use a Nested Array Block containing first name, last name, and current club.

### Requirement 12: Tutor Block

**User Story:** As a developer, I want a tutor block, so that legal-guardian verification is captured.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a tutor block containing a legal-guardian verification Attachment.

### Requirement 13: Club Worker Block

**User Story:** As a developer, I want a club-worker block, so that staff data initially loaded by the club is captured, even while incomplete.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model a club-worker block containing first name, last name, work area, position, work performed, and contact number.
2. THE club-worker block SHALL model a prior-jobs array using a Nested Array Block, and SHALL mark the prior-jobs block as incomplete with an inline comment indicating that fields are pending.

### Requirement 14: Extensibility Structure

**User Story:** As a developer, I want each block and array modeled as its own small interface, so that new fields can be added later without breaking the structure.

#### Acceptance Criteria

1. THE UserProfileDto SHALL model each Profile Block as its own named interface, where the UserProfileDto references each Profile Block interface as a distinct property rather than inlining its fields.
2. THE UserProfileDto SHALL model each Nested Array Block as its own named interface referenced through an array-typed property, even when the interface currently declares zero known fields.
3. WHERE a field's presence is not guaranteed for every user, THE UserProfileDto SHALL declare that field as optional such that an instance omitting the field is still assignable to the interface without a type error.
4. THE UserProfileDto SHALL define sport-dependent lists (categories, positions) as interface or type declarations only, containing no assigned literal values, initializers, or exported constant instances.
5. WHEN a new field is added to any Profile Block or Nested Array Block interface as an optional field, THE UserProfileDto SHALL continue to type-check without modification to any other interface, such that previously valid instances remain assignable.
