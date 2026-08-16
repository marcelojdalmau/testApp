import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThemeService, ThemeSkin, AVAILABLE_SKINS } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  imports: [CommonModule, MatMenuModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="skinMenu"
      matTooltip="Cambiar estilo"
      class="skin-trigger"
    >
      <mat-icon>{{ themeService.currentSkinInfo().icon }}</mat-icon>
    </button>

    <mat-menu #skinMenu="matMenu" class="skin-menu-panel">
      <div class="skin-menu-header">Elegí tu estilo</div>
      @for (skin of skins; track skin.id) {
        <button
          mat-menu-item
          (click)="selectSkin(skin.id)"
          [class.active-skin]="themeService.skin() === skin.id"
        >
          <mat-icon>{{ skin.icon }}</mat-icon>
          <div class="skin-menu-item">
            <span class="skin-name">{{ skin.label }}</span>
            <span class="skin-description">{{ skin.description }}</span>
          </div>
          @if (themeService.skin() === skin.id) {
            <mat-icon class="check-icon">check_circle</mat-icon>
          }
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .skin-trigger {
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.1);
      }
    }

    .skin-menu-header {
      padding: 8px 16px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sh-on-surface-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--sh-border);
      margin-bottom: 4px;
    }

    .skin-menu-item {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
      flex: 1;
    }

    .skin-name {
      font-size: 0.9rem;
      font-weight: 600;
    }

    .skin-description {
      font-size: 0.72rem;
      color: var(--sh-on-surface-secondary);
      margin-top: 1px;
    }

    .active-skin {
      background-color: var(--sh-surface-variant) !important;
    }

    .check-icon {
      color: var(--sh-accent);
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-left: 8px;
    }
  `]
})
export class ThemeSwitcherComponent {
  themeService = inject(ThemeService);
  skins = AVAILABLE_SKINS;

  selectSkin(skin: ThemeSkin): void {
    this.themeService.setSkin(skin);
  }
}
