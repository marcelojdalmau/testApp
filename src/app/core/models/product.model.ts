import { SportDiscipline } from './user.model';

export type ProductCategory =
  | 'footwear'
  | 'apparel'
  | 'equipment'
  | 'nutrition'
  | 'technology'
  | 'accessories';

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: ProductCategory;
  discipline: SportDiscipline | 'all';
  rating: number;
  reviewCount: number;
  tags: string[];
  inStock: boolean;
  featured?: boolean;
}
