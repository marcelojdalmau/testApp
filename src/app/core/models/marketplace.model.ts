import { SportDiscipline, UserRole } from './user.model';

/** A job posting or convocatoria */
export interface Convocatoria {
  id: string;
  publisherId: string;
  publisherName: string;
  publisherRole: UserRole;
  title: string;
  description: string;
  discipline: SportDiscipline;
  location: string;
  type: 'job' | 'tryout' | 'sponsor' | 'service';
  requirements?: string[];
  budget?: string;
  createdAt: string;
  status: 'open' | 'closed';
}

/** Search result card for marketplace */
export interface MarketplaceCard {
  id: string;
  userId: string;
  fullName: string;
  avatar?: string;
  role: UserRole;
  discipline: SportDiscipline;
  location: string;
  rating: number;
  reviewCount: number;
  headline: string; // e.g., "Nutricionista deportivo - ISAK I"
  priceRange?: string;
  tags: string[];
}
