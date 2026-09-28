import { InjectionToken } from '@angular/core';

/**
 * Dotted path to a field within the `UserProfileDto` used to decide profile
 * completeness (e.g. `common.email`). Kept as a plain `string` so the required
 * field set is not rigidly coupled to the throwaway mock DTO.
 */
export type RequiredFieldPath = string;

/**
 * Configurable list of profile fields that must be present for a profile to be
 * considered complete (Req 5.2, 5.3).
 *
 * The default value are the `common` block fields currently marked as required
 * in TypeScript (declared without `?`). When the mock `UserProfileDto` is
 * replaced, only this list needs to be updated; the resolver logic stays intact.
 */
export const PROFILE_REQUIRED_FIELDS = new InjectionToken<RequiredFieldPath[]>(
  'PROFILE_REQUIRED_FIELDS',
  {
    providedIn: 'root',
    factory: (): RequiredFieldPath[] => [
      'common.profilePhoto',
      'common.email',
      'common.firstName',
      'common.lastName',
      'common.birthDate',
      'common.identityDocumentNumber',
      'common.documentTypeId',
      'common.idCardVerification',
      'common.nationalityId',
      'common.sexId',
      'common.personTypeId',
    ],
  },
);
