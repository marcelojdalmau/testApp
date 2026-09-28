# Implementation Plan: User Profile DTOs

## Overview

Author a single, throwaway TypeScript data-shape module (`src/app/core/models/user-profile-dto.model.ts`) that groups every profile persona into one root `UserProfileDto` interface, with each persona modeled as its own optional block interface and each nested array element as its own named interface. The module contains **data shapes only** — no logic, no classes, no validation, no mock values, and no imports from existing models.

Because this feature is pure type modeling with no runtime behavior, "tests" are **compile-time type assertions** verified by the TypeScript compiler (a `*.type-test.ts` file plus `tsc`/`ng build`), not runtime property-based tests. Type-assertion sub-tasks are marked optional with `*`; the module authoring and the final compile check are core tasks.

Implementation language: **TypeScript** (fixed by the design's Data Models section — no language choice needed).

## Tasks

- [x] 1. Create the DTO module with shared types and the root interface
  - Create the new file `src/app/core/models/user-profile-dto.model.ts` with the file-header comment marking it as a throwaway, data-shapes-only mock that does not import or modify existing models
  - Add the shared `ProfileAttachment` interface (`fileName`, `url`, optional `mimeType` with a `pending` comment) used by every "file" field
  - Add the `ProfileAthleteLevel` union type alias (`'amateur' | 'elite' | 'professional'`)
  - Declare the root `UserProfileDto` interface with exactly one Entity Id `id: string` and one optional property per persona block (`common?`, `naturalPerson?`, `healthProfessional?`, `athlete?`, `anatomical?`, `club?`, `manager?`, `tutor?`, `clubWorker?`)
  - Add no methods, no statements, no runtime constants, and no imports
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.2, 2.3, 3.1, 4.1, 8.2, 14.1, 14.4_

- [x] 2. Author the common and natural-person blocks
  - [x] 2.1 Add `ProfileCommonBlock`
    - Declare required fields: `profilePhoto: ProfileAttachment`, `email`, `firstName`, `lastName`, `birthDate: Date`, `identityDocumentNumber`, `documentTypeId`, `idCardVerification: ProfileAttachment`, `nationalityId`, `sexId`, `personTypeId`
    - Declare optional fields: `visibleInMarketplace?` (with marketplace-dependency comment), `address?`, `postalCode?`, `city?`, `province?`, `country?`, `phone?`
    - Add Catalog FK inline comments naming the pending backend catalog for `documentTypeId`, `nationalityId`, `sexId`, `personTypeId`; type `birthDate` as `Date`
    - _Requirements: 3.2, 3.4, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Add `ProfileNaturalPersonBlock`
    - Declare optional `sportsPracticed?: string[]`, `hobbies?: string[]`, `isAmateurSports?: boolean`
    - _Requirements: 6.1, 6.2_

- [x] 3. Author the health-professional block and its nested array interfaces
  - [x] 3.1 Add `ProfileHealthProfessionalBlock`
    - Declare `worksRemotely?: boolean`, required `isLicensed: boolean`, `licenseId?` (Catalog FK, conditional-on-`isLicensed` comment), `professionTypeId?` (Catalog FK comment), `studyInstitution?`, `graduationDate?: Date`, and the four nested arrays (`studies?`, `languages?`, `workExperience?`, `skills?`)
    - _Requirements: 3.2, 7.1, 7.2, 7.3_

  - [x] 3.2 Add the health-professional nested array interfaces
    - `ProfileStudyEntry` with required `studyLevelId: string` (Catalog FK comment), `graduationYear?`, `obtainedDegree?`, `average?`, `degree?: ProfileAttachment`
    - `ProfileLanguageEntry` with `language?`, `level?`, `institution?`, `graduationYear?`, `certificate?: ProfileAttachment`
    - `ProfileWorkExperienceEntry` with `workplace?`, `startDate?: Date`, `endDate?: Date`, `currentlyWorking?: boolean`, `referenceContact?`, `position?`, `additionalDetails?`
    - `ProfileSkillEntry` with `skillType?`, `additionalDetails?`
    - _Requirements: 3.2, 4.3, 7.4, 7.5, 7.6, 7.7, 14.2_

- [x] 4. Author the athlete block and its nested array interfaces
  - [x] 4.1 Add `ProfileAthleteBlock` and `ProfileSportEntry`
    - `ProfileAthleteBlock` with `sports?: ProfileSportEntry[]`
    - `ProfileSportEntry` with `sportType?`, `personalRecord?`, `categoryId?` (sport-dependent Catalog FK comment), `naturalPositionIds?: string[]` (sport-dependent Catalog FK comment), `level?: ProfileAthleteLevel`, `currentClub?`, `entryDate?: Date`, `priorExperience?`, `competitions?`
    - _Requirements: 3.3, 8.1, 8.2, 8.5, 14.2_

  - [x] 4.2 Add the sport nested array interfaces
    - `ProfileSportPriorExperienceEntry` with `club?`, `positionIds?: string[]` (sport-dependent Catalog FK comment), `entryDate?: Date`, `exitDate?: Date`, `details?`
    - `ProfileCompetitionEntry` with `tournament?`, `year?`, `tournamentPosition?`, `achievementIds?: string[]` (Catalog FK comment), `details?`
    - _Requirements: 3.3, 8.3, 8.4, 8.5, 14.2_

- [x] 5. Author the remaining persona blocks and their nested array interfaces
  - [x] 5.1 Add `ProfileAnatomicalBlock` and `ProfileInjuryEntry`
    - Declare all fields optional (`weight?`, `height?`, `bloodGroup?`, `anthropometry?`, `somatotypeId?` Catalog FK, `clinicalHistory?`, `injuries?`, `medicalRestrictions?`) and mark the block incomplete with a `pending` comment
    - `ProfileInjuryEntry` with optional `description?` and a `pending` comment
    - _Requirements: 3.2, 9.1, 9.2, 14.2, 14.3_

  - [x] 5.2 Add `ProfileClubBlock`, `ProfileDisciplineEntry`, and `ProfileFacilityEntry`
    - `ProfileClubBlock` with `name?`, `legalName?`, `foundingYear?`, `location?`, `phone?`, `socialLinks?: string[]`, `disciplines?`, `facilities?`
    - `ProfileDisciplineEntry` with `disciplineName?`, `categoryIds?: string[]` (Catalog FK comment)
    - `ProfileFacilityEntry` with `name?`, `typeIds?: string[]` (Catalog FK comment), `location?`, `phoneNumber?`, `internalDetails?` (club-internal visibility comment)
    - _Requirements: 3.3, 10.1, 10.2, 10.3, 14.2_

  - [x] 5.3 Add `ProfileManagerBlock`, `ProfileRepresentedPlayerEntry`, `ProfileTutorBlock`, `ProfileClubWorkerBlock`, and `ProfilePriorJobEntry`
    - `ProfileManagerBlock` with `representedPlayerCount?`, `mainDiscipline?`, `representedPlayers?`; `ProfileRepresentedPlayerEntry` with `firstName?`, `lastName?`, `currentClub?`
    - `ProfileTutorBlock` with `legalGuardianVerification?: ProfileAttachment`
    - `ProfileClubWorkerBlock` with `firstName?`, `lastName?`, `workArea?`, `position?`, `workPerformed?`, `contactNumber?`, `priorJobs?`; `ProfilePriorJobEntry` with optional `description?` and a `pending` comment marking the block incomplete
    - _Requirements: 4.3, 11.1, 11.2, 12.1, 13.1, 13.2, 14.2_

- [x] 6. Checkpoint - Ensure the module compiles
  - Confirm `user-profile-dto.model.ts` compiles standalone under the project's TypeScript config (`tsc --noEmit` / `ng build`) with zero imports from existing models and no name collisions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Author compile-time type-assertion checks
  - [x] 7.1 Create the type-test file with minimal-instance assignability checks
    - Add `src/app/core/models/user-profile-dto.type-test.ts` (or `.spec.ts`) importing the DTO types
    - Assert `const root: UserProfileDto = { id: 'x' };` compiles; assert `{}` is assignable to `ProfileAnatomicalBlock` and `ProfilePriorJobEntry`; construct each block with only its required fields
    - **Property 1: Minimal-instance assignability**
    - **Validates: Requirements 1.2, 9.2, 13.2, 14.3**

  - [x] 7.2 Add required-field enforcement checks
    - Use `@ts-expect-error` to assert that omitting `id` on `UserProfileDto`, `idCardVerification` on `ProfileCommonBlock`, and `isLicensed` on `ProfileHealthProfessionalBlock` fails to compile
    - **Validates: Requirements 3.1, 4.2, 5.2, 7.2**

  - [x] 7.3 Add additive-field preservation check
    - Declare a local interface extending a block with one extra optional field and assert a previously valid instance is still assignable, with no change to other interfaces
    - **Property 2: Additive optional field preserves assignability**
    - **Validates: Requirements 14.5**

  - [x] 7.4 Add shared-attachment typing check
    - Assign one `ProfileAttachment` value across `profilePhoto`, `idCardVerification`, `degree`, `certificate`, and `legalGuardianVerification`; assert all compile
    - **Property 3: Shared attachment typing**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 7.5 Add no-collision import check
    - In the type-test file, `import * as dto from './user-profile-dto.model'` alongside imports from `user.model`, `club.model`, and other existing models; assert no duplicate-identifier error
    - **Property 4: No name collision with existing exports**
    - **Validates: Requirements 2.1**

- [x] 8. Final checkpoint - Ensure everything type-checks
  - Run the project's `tsc --noEmit` / `ng build` over the module and the type-test file and confirm a clean compile
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional compile-time type-assertion checks and can be skipped for a faster minimum-viable artifact; the minimum verification is that the module plus a single minimal-instance type-test compiles.
- These are **not** runtime property-based tests. The feature has no runtime behavior; the correctness properties are type-level invariants checked by the TypeScript compiler.
- Each task references specific requirement sub-clauses for traceability.
- Property 5 (isolation) and Property 6 (type-only sport lists) are satisfied by construction in Task 1 and verified at the checkpoints via the standalone compile and the absence of runtime exports — they need no separate assertion task.
- The module and type-test file are the only files created; no existing model is modified (Req 2.3).

## Task Dependency Graph

All block-authoring tasks (2.1–5.3) edit the single module file `user-profile-dto.model.ts`, so they are serialized across waves to avoid write conflicts rather than run in parallel. The type-assertion tasks (7.1–7.5) all edit the single type-test file and are likewise serialized.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2"] },
    { "id": 12, "tasks": ["7.3"] },
    { "id": 13, "tasks": ["7.4"] },
    { "id": 14, "tasks": ["7.5"] }
  ]
}
```
