import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { MockProductService, ProductFilters } from '../../mock-data/services/mock-product.service';
import { Product, ProductCategory } from '../../core/models/product.model';
import { SportDiscipline } from '../../core/models/user.model';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './marketplace.component.html',
  styleUrl: './marketplace.component.scss',
})
export class MarketplaceComponent implements OnInit {
  private productService = inject(MockProductService);

  productSearch = '';
  selectedCategory: ProductCategory | '' = '';
  selectedDiscipline: SportDiscipline | 'all' | '' = '';

  products = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);

  categories: { value: ProductCategory | ''; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'footwear', label: 'Calzado' },
    { value: 'apparel', label: 'Indumentaria' },
    { value: 'equipment', label: 'Equipamiento' },
    { value: 'nutrition', label: 'Nutrición' },
    { value: 'technology', label: 'Tecnología' },
    { value: 'accessories', label: 'Accesorios' },
  ];

  disciplines: { value: SportDiscipline | 'all' | ''; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'all', label: 'Multideporte' },
    { value: 'football', label: 'Fútbol' },
    { value: 'basketball', label: 'Básquet' },
    { value: 'rugby', label: 'Rugby' },
    { value: 'hockey', label: 'Hockey' },
    { value: 'running', label: 'Running' },
    { value: 'boxing', label: 'Boxeo' },
    { value: 'swimming', label: 'Natación' },
    { value: 'cycling', label: 'Ciclismo' },
  ];

  ngOnInit(): void {
    this.productService.getProducts().subscribe(prods => {
      this.products.set(prods);
      this.filteredProducts.set(prods);
    });
  }

  applyFilters(): void {
    const filters: ProductFilters = {};
    if (this.productSearch) filters.query = this.productSearch;
    if (this.selectedCategory) filters.category = this.selectedCategory as ProductCategory;
    if (this.selectedDiscipline) filters.discipline = this.selectedDiscipline as SportDiscipline | 'all';

    this.productService.searchProducts(filters).subscribe(results => {
      this.filteredProducts.set(results);
    });
  }

  clearFilters(): void {
    this.productSearch = '';
    this.selectedCategory = '';
    this.selectedDiscipline = '';
    this.filteredProducts.set(this.products());
  }

  formatPrice(price: number): string {
    return '$' + price.toLocaleString('es-AR');
  }
}
