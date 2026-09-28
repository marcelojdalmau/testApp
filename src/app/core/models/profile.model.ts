import { UserProfileDto } from './user-profile-dto.model';

/**
 * Sobre de respuesta del Profile_Endpoint. Req 4.2, 5.1.
 */
export interface ProfileResponse {
  profile: UserProfileDto;
  // Profile_Completeness_Flag [CONFIRMAR CON BACKEND]. Req 5.1.
  profile_complete?: boolean;
}
