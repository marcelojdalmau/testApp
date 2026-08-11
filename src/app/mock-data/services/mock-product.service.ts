import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product, ProductCategory } from '../../core/models/product.model';
import { SportDiscipline } from '../../core/models/user.model';
import { MOCK_PRODUCTS } from '../products.data';

export interface ProductFilters {
  query?: string;
  category?: ProductCategory;
  discipline?: SportDiscipline | 'all';
  maxPrice?: number;
  inStockOnly?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MockProductService {

  getProducts(): Observable<Product[]> {
    return of(MOCK_PRODUCTS);
  }

  getFeaturedProducts(): Observable<Product[]> {
    return of(MOCK_PRODUCTS.filter(p => p.featured));
  }

  searchProducts(filters: ProductFilters): Observable<Product[]> {
    let results = [...MOCK_PRODUCTS];

    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (filters.category) {
      results = results.filter(p => p.category === filters.category);
    }

    if (filters.discipline && filters.discipline !== 'all') {
      results = results.filter(p => p.discipline === filters.discipline || p.discipline === 'all');
    }

    if (filters.maxPrice) {
      results = results.filter(p => p.price <= filters.maxPrice!);
    }

    if (filters.inStockOnly) {
      results = results.filter(p => p.inStock);
    }

    return of(results);
  }

  getProductById(id: string): Observable<Product | undefined> {
    return of(MOCK_PRODUCTS.find(p => p.id === id));
  }

  getProductsByCategory(category: ProductCategory): Observable<Product[]> {
    return of(MOCK_PRODUCTS.filter(p => p.category === category));
  }
}
