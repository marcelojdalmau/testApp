// src/app/core/models/user-profile-dto.model.ts
//
// Throwaway mock DTO for profile data. Data shapes only — no logic, no
// validation, no classes, no mock values. Does not import or modify existing
// models. Intended to be deleted later.

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A single uploaded file/document (ID photo, diploma, certificate, ...). Req 4 */
export interface ProfileAttachment {
  fileName: string;
  url: string;       // reference to the stored file
  mimeType?: string; // pending: attachment metadata not finalized
}

/** Athlete level. Req 8.2 */
export type ProfileAthleteLevel = 'amateur' | 'elite' | 'professional';

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * Single root profile DTO. Each persona block is optional so any persona can be
 * mocked in isolation. Req 1.1, 1.2, 14.1
 */
export interface UserProfileDto {
  id: string; // Entity Id — the profile's own primary identifier. Req 3.1

  common?: ProfileCommonBlock;
  naturalPerson?: ProfileNaturalPersonBlock;
  healthProfessional?: ProfileHealthProfessionalBlock;
  athlete?: ProfileAthleteBlock;
  anatomical?: ProfileAnatomicalBlock;
  club?: ProfileClubBlock;
  manager?: ProfileManagerBlock;
  tutor?: ProfileTutorBlock;
  clubWorker?: ProfileClubWorkerBlock;
}
// ---------------------------------------------------------------------------
// Common block. Req 5
// ---------------------------------------------------------------------------

export interface ProfileCommonBlock {
  visibleInMarketplace?: boolean; // optional: only relevant for marketplace visibility. Req 5.4

  profilePhoto: ProfileAttachment;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: Date; // Req 5.3
  identityDocumentNumber: string;
  documentTypeId: string;  // Catalog FK — pending backend "document type" catalog. Req 3.2
  idCardVerification: ProfileAttachment; // required verification photo. Req 4.2
  nationalityId: string;   // Catalog FK — pending backend "nationality" catalog
  sexId: string;           // Catalog FK — pending backend "sex" catalog
  personTypeId: string;    // Catalog FK — pending backend "person type" catalog

  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  country?: string;
  phone?: string;
}
// ---------------------------------------------------------------------------
// Natural person block. Req 6
// ---------------------------------------------------------------------------

export interface ProfileNaturalPersonBlock {
  sportsPracticed?: string[];
  hobbies?: string[];
  isAmateurSports?: boolean; // Req 6.2
}
// ---------------------------------------------------------------------------
// Health professional block. Req 7
// ---------------------------------------------------------------------------

export interface ProfileHealthProfessionalBlock {
  worksRemotely?: boolean; // Req 7.2
  isLicensed: boolean;     // required. Req 7.2
  licenseId?: string;      // Catalog FK — pending backend "license" catalog; only when isLicensed is true. Req 3.2, 7.3
  professionTypeId?: string; // Catalog FK — pending backend "profession type" catalog. Req 3.2
  studyInstitution?: string;
  graduationDate?: Date;

  studies?: ProfileStudyEntry[];
  languages?: ProfileLanguageEntry[];
  workExperience?: ProfileWorkExperienceEntry[];
  skills?: ProfileSkillEntry[];
}
/** One study entry. Req 7.4 */
export interface ProfileStudyEntry {
  studyLevelId: string; // required. Catalog FK — pending backend "study level" catalog. Req 3.2
  graduationYear?: number;
  obtainedDegree?: string;
  average?: number;
  degree?: ProfileAttachment;
}

/** One language entry. Req 7.5 */
export interface ProfileLanguageEntry {
  language?: string;
  level?: string;
  institution?: string;
  graduationYear?: number;
  certificate?: ProfileAttachment;
}

/** One work-experience entry. Req 7.6 */
export interface ProfileWorkExperienceEntry {
  workplace?: string;
  startDate?: Date;
  endDate?: Date;
  currentlyWorking?: boolean;
  referenceContact?: string;
  position?: string;
  additionalDetails?: string;
}

/** One skill entry. Req 7.7 */
export interface ProfileSkillEntry {
  skillType?: string;
  additionalDetails?: string;
}
// ---------------------------------------------------------------------------
// Athlete block. Req 8
// ---------------------------------------------------------------------------

export interface ProfileAthleteBlock {
  sports?: ProfileSportEntry[];
}

/** One sport the athlete practices. Req 8.2 */
export interface ProfileSportEntry {
  sportType?: string;
  personalRecord?: string;
  categoryId?: string;         // Catalog FK — sport-dependent; pending backend "category" catalog. Req 8.5
  naturalPositionIds?: string[]; // Catalog FK[] — sport-dependent; pending backend "position" catalog. Req 3.3, 8.5
  level?: ProfileAthleteLevel;
  currentClub?: string;
  entryDate?: Date;

  priorExperience?: ProfileSportPriorExperienceEntry[];
  competitions?: ProfileCompetitionEntry[];
}
/** One prior-experience entry for a sport. Req 8.3 */
export interface ProfileSportPriorExperienceEntry {
  club?: string;
  positionIds?: string[]; // Catalog FK[] — sport-dependent; pending backend "position" catalog. Req 3.3, 8.5
  entryDate?: Date;
  exitDate?: Date;
  details?: string;
}

/** One competition entry for a sport. Req 8.4 */
export interface ProfileCompetitionEntry {
  tournament?: string;
  year?: number;
  tournamentPosition?: string;
  achievementIds?: string[]; // Catalog FK[] — pending backend "achievement" catalog. Req 3.3
  details?: string;
}
// ---------------------------------------------------------------------------
// Anatomical / clinical block. Req 9
// ---------------------------------------------------------------------------

/** pending: anatomical/clinical block is incomplete; fields will be added later. Req 9.2 */
export interface ProfileAnatomicalBlock {
  weight?: number;
  height?: number;
  bloodGroup?: string;
  anthropometry?: string;
  somatotypeId?: string; // Catalog FK — pending backend "somatotype" catalog. Req 3.2
  clinicalHistory?: string;
  injuries?: ProfileInjuryEntry[];
  medicalRestrictions?: string;
}

/** One injury entry. pending: shape incomplete. Req 9.1 */
export interface ProfileInjuryEntry {
  description?: string; // pending: injury fields not finalized
}
// ---------------------------------------------------------------------------
// Club block. Req 10
// ---------------------------------------------------------------------------

export interface ProfileClubBlock {
  name?: string;
  legalName?: string;
  foundingYear?: number;
  location?: string;
  phone?: string;
  socialLinks?: string[];

  disciplines?: ProfileDisciplineEntry[];
  facilities?: ProfileFacilityEntry[];
}

/** One discipline the club offers. Req 10.2 */
export interface ProfileDisciplineEntry {
  disciplineName?: string;
  categoryIds?: string[]; // Catalog FK[] — pending backend "category" catalog. Req 3.3
}

/** One club facility. Req 10.3 */
export interface ProfileFacilityEntry {
  name?: string;
  typeIds?: string[]; // Catalog FK[] — pending backend "facility type" catalog. Req 3.3
  location?: string;
  phoneNumber?: string;
  internalDetails?: string; // club-internal visibility only. Req 10.3
}
// ---------------------------------------------------------------------------
// Manager block. Req 11
// ---------------------------------------------------------------------------

export interface ProfileManagerBlock {
  representedPlayerCount?: number;
  mainDiscipline?: string;
  representedPlayers?: ProfileRepresentedPlayerEntry[];
}

/** One represented player. Req 11.2 */
export interface ProfileRepresentedPlayerEntry {
  firstName?: string;
  lastName?: string;
  currentClub?: string;
}

// ---------------------------------------------------------------------------
// Tutor block. Req 12
// ---------------------------------------------------------------------------

export interface ProfileTutorBlock {
  legalGuardianVerification?: ProfileAttachment; // Req 12.1
}

// ---------------------------------------------------------------------------
// Club worker block. Req 13
// ---------------------------------------------------------------------------

export interface ProfileClubWorkerBlock {
  firstName?: string;
  lastName?: string;
  workArea?: string;
  position?: string;
  workPerformed?: string;
  contactNumber?: string;

  priorJobs?: ProfilePriorJobEntry[];
}

/** One prior job. pending: prior-jobs block is incomplete; fields will be added later. Req 13.2 */
export interface ProfilePriorJobEntry {
  description?: string; // pending: prior-job fields not finalized
}
