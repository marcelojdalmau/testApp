import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChildrenOutletContexts, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { ThemeService } from '../services/theme.service';
import { DemoSwitcherComponent } from '../../shared/components/demo-switcher/demo-switcher.component';
import { routeAnimations } from '../animations/route-animations';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatTooltipModule,
    DemoSwitcherComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  animations: [routeAnimations],
})
export class LayoutComponent {
  private breakpointObserver = inject(BreakpointObserver);
  private contexts = inject(ChildrenOutletContexts);
  themeService = inject(ThemeService);

  /** Whether we're in mobile viewport */
  isMobile = toSignal(
    this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  /** Sidebar collapsed state (desktop only) */
  sidebarCollapsed = signal(false);

  /** Navigation items */
  navItems: NavItem[] = [
    { label: 'Inicio', icon: 'home', route: '/feed' },
    { label: 'Buscar', icon: 'search', route: '/marketplace' },
    { label: 'Gestión', icon: 'dashboard', route: '/management' },
    { label: 'Mensajes', icon: 'chat', route: '/communication' },
    { label: 'Perfil', icon: 'person', route: '/profile' },
  ];

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.url.toString();
  }
}
