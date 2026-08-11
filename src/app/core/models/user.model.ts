/** User roles in the SportHub ecosystem */
export type UserRole =
  | 'athlete'
  | 'health-professional'
  | 'coach'
  | 'institution'
  | 'management';

/** Sub-types for athletes */
export type AthleteLevel = 'amateur' | 'semi-professional' | 'professional';

/** Sub-types for health professionals */
export type HealthProfessionalType =
  | 'nutritionist'
  | 'physical-trainer'
  | 'kinesiologist'
  | 'sports-doctor'
  | 'psychologist';

/** Sub-types for coaches */
export type CoachType =
  | 'head-coach'
  | 'assistant-coach'
  | 'video-analyst'
  | 'goalkeeper-coach';

/** Sub-types for institution */
export type InstitutionType =
  | 'club'
  | 'league'
  | 'gym'
  | 'running-team'
  | 'academy';

/** Sub-types for management */
export type ManagementType =
  | 'agent'
  | 'brand'
  | 'press'
  | 'equipment-manager';

/** Sport disciplines */
export type SportDiscipline =
  | 'football'
  | 'basketball'
  | 'rugby'
  | 'hockey'
  | 'tennis'
  | 'swimming'
  | 'running'
  | 'volleyball'
  | 'boxing'
  | 'martial-arts'
  | 'cycling'
  | 'other';

/** Base user profile */
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: UserRole;
  discipline: SportDiscipline;
  location: string;
  bio?: string;
  createdAt: Date;
}

/** Athlete-specific profile data */
export interface AthleteProfile extends UserProfile {
  role: 'athlete';
  level: AthleteLevel;
  position?: string;
  currentClub?: string;
  age?: number;
  height?: number;
  weight?: number;
}

/** Health professional profile data */
export interface HealthProfessionalProfile extends UserProfile {
  role: 'health-professional';
  specialtyType: HealthProfessionalType;
  certifications: string[];
  servicesOffered: string[];
  priceRange?: string;
}

/** Coach profile data */
export interface CoachProfile extends UserProfile {
  role: 'coach';
  coachType: CoachType;
  currentTeam?: string;
  experience?: string;
  certifications: string[];
}

/** Institution profile data */
export interface InstitutionProfile extends UserProfile {
  role: 'institution';
  institutionType: InstitutionType;
  foundedYear?: number;
  facilities?: string[];
  divisions?: string[];
  memberCount?: number;
}

/** Management profile data */
export interface ManagementProfile extends UserProfile {
  role: 'management';
  managementType: ManagementType;
  company?: string;
  portfolio?: string[];
}

/** Union type for all profiles */
export type AnyUserProfile =
  | AthleteProfile
  | HealthProfessionalProfile
  | CoachProfile
  | InstitutionProfile
  | ManagementProfile;

/** Role display info for the selector */
export interface RoleOption {
  role: UserRole;
  label: string;
  description: string;
  icon: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'athlete',
    label: 'Deportista',
    description: 'Amateur o profesional. Gestioná tu carrera deportiva.',
    icon: 'directions_run',
  },
  {
    role: 'health-professional',
    label: 'Profesional de la Salud',
    description: 'Nutricionista, PF, Kinesiólogo, Médico deportivo.',
    icon: 'medical_services',
  },
  {
    role: 'coach',
    label: 'Entrenador / Cuerpo Técnico',
    description: 'DT, Asistente, Videoanalista, Preparador.',
    icon: 'sports',
  },
  {
    role: 'institution',
    label: 'Institución / Club',
    description: 'Club, Liga, Box, Running Team, Academia.',
    icon: 'stadium',
  },
  {
    role: 'management',
    label: 'Gestión / Marcas / Servicios',
    description: 'Agente, Marca deportiva, Prensa, Utilería.',
    icon: 'business_center',
  },
];
