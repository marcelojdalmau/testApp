import { SportDiscipline } from './user.model';

/** A division within a club (e.g., Primera, Reserva, 5ta División) */
export interface Division {
  id: string;
  clubId: string;
  name: string;
  category: string; // e.g., "Sub-17", "Primera", "Reserva"
  playerIds: string[];
  staffIds: string[]; // coaches + health professionals assigned
}

/** Club with its divisions */
export interface Club {
  id: string;
  name: string;
  logo?: string;
  discipline: SportDiscipline;
  location: string;
  foundedYear: number;
  facilities: string[];
  divisions: Division[];
  description?: string;
  memberCount: number;
  colors: string; // e.g., "Azul y Oro"
}

/** A recommendation/assignment from a staff member to a player */
export interface StaffRecommendation {
  id: string;
  playerId: string;
  staffId: string;
  staffName: string;
  staffRole: string; // e.g., "Nutricionista", "Preparador Físico"
  type: 'diet' | 'exercise' | 'rehabilitation' | 'psychological' | 'tactical';
  title: string;
  description: string;
  details: string[];
  createdAt: string;
  status: 'active' | 'completed' | 'pending';
}
