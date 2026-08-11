import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

import { MockMarketplaceService } from '../../mock-data/services/mock-marketplace.service';
import { Convocatoria } from '../../core/models/marketplace.model';

@Component({
  selector: 'app-convocatorias',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
  ],
  templateUrl: './convocatorias.component.html',
  styleUrl: './convocatorias.component.scss',
})
export class ConvocatoriasComponent implements OnInit {
  private marketplaceService = inject(MockMarketplaceService);

  convocatorias = signal<Convocatoria[]>([]);

  ngOnInit(): void {
    this.marketplaceService.getOpenConvocatorias().subscribe(convs => {
      this.convocatorias.set(convs);
    });
  }

  getConvocatoriaIcon(type: string): string {
    switch (type) {
      case 'job': return 'work';
      case 'tryout': return 'sports_soccer';
      case 'sponsor': return 'handshake';
      case 'service': return 'medical_services';
      default: return 'work';
    }
  }

  getConvocatoriaColor(type: string): string {
    switch (type) {
      case 'job': return '#1565c0';
      case 'tryout': return '#e65100';
      case 'sponsor': return '#2e7d32';
      case 'service': return '#6a1b9a';
      default: return '#616161';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'job': return 'Empleo';
      case 'tryout': return 'Prueba';
      case 'sponsor': return 'Sponsor';
      case 'service': return 'Servicio';
      default: return type;
    }
  }
}
