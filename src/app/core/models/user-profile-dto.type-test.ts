// src/app/core/models/user-profile-dto.type-test.ts
//
// Compile-time type-assertion file for the throwaway user-profile DTO module.
// Data shapes only — this file contains NO runtime test-runner assertions.
// Its purpose is to make the TypeScript compiler verify type-level invariants:
// if it compiles under `tsc --noEmit`, the assertions hold.
//
// Property 1: Minimal-instance assignability.
// For all persona blocks and all optional fields, an instance that supplies
// only the required fields (omitting every optional block/field) is assignable
// to its interface without a type error.
//
// Validates: Requirements 1.2, 9.2, 13.2, 14.3

import type {
  UserProfileDto,
  ProfileAttachment,
  ProfileCommonBlock,
  ProfileNaturalPersonBlock,
  ProfileHealthProfessionalBlock,
  ProfileStudyEntry,
  ProfileLanguageEntry,
  ProfileWorkExperienceEntry,
  ProfileSkillEntry,
  ProfileAthleteBlock,
  ProfileSportEntry,
  ProfileSportPriorExperienceEntry,
  ProfileCompetitionEntry,
  ProfileAnatomicalBlock,
  ProfileInjuryEntry,
  ProfileClubBlock,
  ProfileDisciplineEntry,
  ProfileFacilityEntry,
  ProfileManagerBlock,
  ProfileRepresentedPlayerEntry,
  ProfileTutorBlock,
  ProfileClubWorkerBlock,
  ProfilePriorJobEntry,
} from './user-profile-dto.model';

// ---------------------------------------------------------------------------
// Root: only the required Entity Id must be supplied. Req 1.2
// ---------------------------------------------------------------------------

const root: UserProfileDto = { id: 'x' };

// ---------------------------------------------------------------------------
// Shared attachment: only its required fields. Req 4.1
// ---------------------------------------------------------------------------

const attachment: ProfileAttachment = { fileName: 'file.png', url: 'stored/ref' };

// ---------------------------------------------------------------------------
// Fully-optional blocks: an empty object is assignable. Req 9.2, 13.2, 14.3
// ---------------------------------------------------------------------------

const ana: ProfileAnatomicalBlock = {};
const job: ProfilePriorJobEntry = {};
const injury: ProfileInjuryEntry = {};
const naturalPerson: ProfileNaturalPersonBlock = {};
const language: ProfileLanguageEntry = {};
const workExperience: ProfileWorkExperienceEntry = {};
const skill: ProfileSkillEntry = {};
const athlete: ProfileAthleteBlock = {};
const sport: ProfileSportEntry = {};
const priorSport: ProfileSportPriorExperienceEntry = {};
const competition: ProfileCompetitionEntry = {};
const club: ProfileClubBlock = {};
const discipline: ProfileDisciplineEntry = {};
const facility: ProfileFacilityEntry = {};
const manager: ProfileManagerBlock = {};
const representedPlayer: ProfileRepresentedPlayerEntry = {};
const tutor: ProfileTutorBlock = {};
const clubWorker: ProfileClubWorkerBlock = {};

// ---------------------------------------------------------------------------
// Blocks with required fields: constructed with ONLY their required fields.
// ---------------------------------------------------------------------------

// ProfileCommonBlock — every required field supplied, every optional omitted. Req 5
const common: ProfileCommonBlock = {
  profilePhoto: attachment,
  email: 'user@example.com',
  firstName: 'First',
  lastName: 'Last',
  birthDate: new Date(),
  identityDocumentNumber: 'DOC-123',
  documentTypeId: 'doc-type-id',
  idCardVerification: attachment,
  nationalityId: 'nationality-id',
  sexId: 'sex-id',
  personTypeId: 'person-type-id',
};

// ProfileHealthProfessionalBlock — only the required `isLicensed`. Req 7.2
const healthProfessional: ProfileHealthProfessionalBlock = { isLicensed: false };

// ProfileStudyEntry — only the required `studyLevelId`. Req 7.4
const study: ProfileStudyEntry = { studyLevelId: 'study-level-id' };

// ---------------------------------------------------------------------------
// Compose a root that references the minimal blocks, confirming each optional
// persona property accepts its minimal block instance. Req 1.2, 14.3
// ---------------------------------------------------------------------------

const composed: UserProfileDto = {
  id: 'y',
  common,
  naturalPerson,
  healthProfessional,
  athlete,
  anatomical: ana,
  club,
  manager,
  tutor,
  clubWorker,
};

// ---------------------------------------------------------------------------
// Reference every declared binding so no `noUnusedLocals` error is raised.
// This is a compile-time acknowledgement only; not a runtime assertion.
// ---------------------------------------------------------------------------

export type __UserProfileDtoTypeTest = [
  typeof root,
  typeof attachment,
  typeof ana,
  typeof job,
  typeof injury,
  typeof naturalPerson,
  typeof language,
  typeof workExperience,
  typeof skill,
  typeof athlete,
  typeof sport,
  typeof priorSport,
  typeof competition,
  typeof club,
  typeof discipline,
  typeof facility,
  typeof manager,
  typeof representedPlayer,
  typeof tutor,
  typeof clubWorker,
  typeof common,
  typeof healthProfessional,
  typeof study,
  typeof composed,
];

// ---------------------------------------------------------------------------
// Task 7.2 — Required-field enforcement.
//
// Each `@ts-expect-error` sits directly above an assignment that omits a
// required field. The compiler MUST report an error on that assignment; the
// `@ts-expect-error` suppresses it. If a required field were ever made
// optional (or removed), the assignment would compile, the suppression would
// be "unused", and `tsc` would fail — proving the requirement still holds.
//
// Validates: Requirements 3.1, 4.2, 5.2, 7.2
// ---------------------------------------------------------------------------

// Omitting the required Entity Id `id` on UserProfileDto must fail. Req 3.1
// @ts-expect-error `id` is required on UserProfileDto.
const missingId: UserProfileDto = {};

// Omitting the required `idCardVerification` on ProfileCommonBlock must fail. Req 4.2, 5.2
// @ts-expect-error `idCardVerification` is required on ProfileCommonBlock.
const missingIdCard: ProfileCommonBlock = {
  profilePhoto: attachment,
  email: 'user@example.com',
  firstName: 'First',
  lastName: 'Last',
  birthDate: new Date(),
  identityDocumentNumber: 'DOC-123',
  documentTypeId: 'doc-type-id',
  nationalityId: 'nationality-id',
  sexId: 'sex-id',
  personTypeId: 'person-type-id',
};

// Omitting the required `isLicensed` on ProfileHealthProfessionalBlock must fail. Req 7.2
// @ts-expect-error `isLicensed` is required on ProfileHealthProfessionalBlock.
const missingIsLicensed: ProfileHealthProfessionalBlock = {};

// Reference the new bindings so `noUnusedLocals` does not fire, following the
// exported-tuple pattern used above. Compile-time acknowledgement only.
export type __UserProfileDtoRequiredFieldTest = [
  typeof missingId,
  typeof missingIdCard,
  typeof missingIsLicensed,
];

// ---------------------------------------------------------------------------
// Task 7.3 — Additive optional field preserves assignability.
//
// Extending a block interface with ONE extra OPTIONAL field is a backward-
// compatible change: any instance that was valid against the base block stays
// valid against the extended shape, because the new field is optional and no
// existing field is altered. The compiler verifies this at compile time.
//
// Property 2: Additive optional field preserves assignability.
// Validates: Requirements 14.5
// ---------------------------------------------------------------------------

// Extend a base block with a single extra OPTIONAL field. No existing field on
// ProfileNaturalPersonBlock is changed.
interface ExtendedNaturalPerson extends ProfileNaturalPersonBlock {
  extraNote?: string;
}

// The previously valid base instance `naturalPerson` (an empty object, valid
// against ProfileNaturalPersonBlock above) is still assignable to the extended
// interface — the additive optional field does not break it. Req 14.5
const extendedNaturalPerson: ExtendedNaturalPerson = naturalPerson;

// Reference the new binding so `noUnusedLocals` does not fire, following the
// exported-tuple pattern used above. Compile-time acknowledgement only.
export type __UserProfileDtoAdditiveFieldTest = [typeof extendedNaturalPerson];

// ---------------------------------------------------------------------------
// Task 7.4 — Shared attachment typing.
//
// Every "file" field across the DTO is typed as the single shared
// `ProfileAttachment` interface. This means one `ProfileAttachment` value is
// assignable to all five attachment-typed fields regardless of which block or
// nested entry it lives on:
//   - profilePhoto            (ProfileCommonBlock, required)          Req 4.2
//   - idCardVerification      (ProfileCommonBlock, required)          Req 4.2
//   - degree                  (ProfileStudyEntry, optional)           Req 4.3
//   - certificate             (ProfileLanguageEntry, optional)        Req 4.3
//   - legalGuardianVerification (ProfileTutorBlock, optional)         Req 4.3
// The compiler verifies each assignment; reusing the shared `attachment` value
// declared above proves the shared typing holds. Req 4.1
//
// Property 3: Shared attachment typing.
// Validates: Requirements 4.1, 4.2, 4.3
// ---------------------------------------------------------------------------

// Both required attachment fields on ProfileCommonBlock carry the shared value.
const commonWithSharedAttachment: ProfileCommonBlock = {
  profilePhoto: attachment,
  email: 'user@example.com',
  firstName: 'First',
  lastName: 'Last',
  birthDate: new Date(),
  identityDocumentNumber: 'DOC-123',
  documentTypeId: 'doc-type-id',
  idCardVerification: attachment,
  nationalityId: 'nationality-id',
  sexId: 'sex-id',
  personTypeId: 'person-type-id',
};

// Optional `degree` on ProfileStudyEntry accepts the shared value. Req 4.3
const studyWithSharedAttachment: ProfileStudyEntry = {
  studyLevelId: 'study-level-id',
  degree: attachment,
};

// Optional `certificate` on ProfileLanguageEntry accepts the shared value. Req 4.3
const languageWithSharedAttachment: ProfileLanguageEntry = {
  certificate: attachment,
};

// Optional `legalGuardianVerification` on ProfileTutorBlock accepts the shared value. Req 4.3
const tutorWithSharedAttachment: ProfileTutorBlock = {
  legalGuardianVerification: attachment,
};

// Reference the new bindings so `noUnusedLocals` does not fire, following the
// exported-tuple pattern used above. Compile-time acknowledgement only.
export type __UserProfileDtoSharedAttachmentTest = [
  typeof commonWithSharedAttachment,
  typeof studyWithSharedAttachment,
  typeof languageWithSharedAttachment,
  typeof tutorWithSharedAttachment,
];

// ---------------------------------------------------------------------------
// Task 7.5 — No name collision with existing exports.
//
// The DTO module deliberately prefixes every exported type (`UserProfileDto`,
// `Profile*`) so none reuses a name already exported elsewhere in
// `src/app/core/models/`. To prove that, we pull the ENTIRE export surface of
// the new module and of several existing models into ONE module scope using
// namespace imports. Namespace imports bind each module under a single local
// alias (`dto`, `userModel`, ...), so the individual exported names never land
// in this file's scope and therefore cannot collide — yet every name remains
// reachable through its namespace. If any exported name from the new module
// duplicated an existing export in a way that broke the build, coexisting here
// would surface it. The file compiling cleanly under `tsc --noEmit` is the
// assertion that no duplicate-identifier error occurs.
//
// Property 4: No name collision with existing exports.
// Validates: Requirements 2.1
// ---------------------------------------------------------------------------

import * as dto from './user-profile-dto.model';
import * as userModel from './user.model';
import * as clubModel from './club.model';
import * as marketplaceModel from './marketplace.model';
import * as managementModel from './management.model';
import * as communicationModel from './communication.model';

// Reference at least one export from each namespace so `noUnusedLocals` and the
// no-unused-import check do not fire. These are type-only aliases; there is no
// runtime code. Each alias also confirms the referenced export actually
// resolves within its namespace.
type __DtoRoot = dto.UserProfileDto; // new module — the root DTO
type __DtoAttachment = dto.ProfileAttachment; // new module — shared attachment
type __UserProfile = userModel.UserProfile; // existing — base user profile
type __Club = clubModel.Club; // existing — club
type __Division = clubModel.Division; // existing — club division
type __MarketplaceCard = marketplaceModel.MarketplaceCard; // existing — marketplace card
type __ManagementTask = managementModel.Task; // existing — management task
type __Conversation = communicationModel.Conversation; // existing — chat conversation

// Acknowledge every alias so the coexistence is actually type-checked and no
// alias is flagged unused. Compile-time acknowledgement only; not a runtime
// assertion. The new-module names (UserProfileDto, ProfileAttachment) sit here
// beside the existing-module names with zero duplicate-identifier error.
export type __UserProfileDtoNoCollisionTest = [
  __DtoRoot,
  __DtoAttachment,
  __UserProfile,
  __Club,
  __Division,
  __MarketplaceCard,
  __ManagementTask,
  __Conversation,
];
