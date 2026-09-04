import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChildrenOutletContexts, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { ThemeService } from '../services/theme.service';
import { CurrentUserService } from '../services/current-user.service';
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
    MatMenuModule,
    MatTooltipModule,
    DemoSwitcherComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [routeAnimations],
})
export class LayoutComponent {
  private breakpointObserver = inject(BreakpointObserver);
  private contexts = inject(ChildrenOutletContexts);
  private currentUser = inject(CurrentUserService);
  themeService = inject(ThemeService);

  /** Whether we're in mobile viewport */
  isMobile = toSignal(
    this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  /** Sidebar collapsed state (desktop only) */
  sidebarCollapsed = signal(false);

  /**
   * Área de "trabajo" dependiente del rol: los deportistas ven su Centro de Control,
   * el resto de los perfiles profesionales ven Gestión. Coincide con los guards de
   * ruta (`athleteGuard` / `professionalGuard`).
   */
  private workspaceItem = computed<NavItem>(() =>
    this.currentUser.role() === 'athlete'
      ? { label: 'Centro de control', icon: 'dashboard', route: '/control-center' }
      : { label: 'Gestión', icon: 'dashboard', route: '/management' }
  );

  /** Navigation items (full - sidebar) */
  navItems = computed<NavItem[]>(() => [
    { label: 'Inicio', icon: 'home', route: '/feed' },
    { label: 'Buscar', icon: 'person_search', route: '/search' },
    { label: 'Convocatorias', icon: 'work', route: '/convocatorias' },
    this.workspaceItem(),
    { label: 'Mensajes', icon: 'chat', route: '/communication' },
    { label: 'Perfil', icon: 'person', route: '/profile' },
  ]);

  /** Bottom nav items (mobile - accesos primarios, espacio limitado) */
  bottomNavItems: NavItem[] = [
    { label: 'Inicio', icon: 'home', route: '/feed' },
    { label: 'Buscar', icon: 'person_search', route: '/search' },
    { label: 'Mensajes', icon: 'chat', route: '/communication' },
    { label: 'Perfil', icon: 'person', route: '/profile' },
  ];

  /**
   * Accesos secundarios que se muestran en el menú "Más" del bottom nav (mobile).
   * Cubre las áreas que no entran en la barra inferior para que ninguna quede
   * inaccesible en celular. A futuro este listado puede volverse configurable
   * (favoritos / accesos frecuentes).
   */
  secondaryNavItems = computed<NavItem[]>(() => [
    { label: 'Convocatorias', icon: 'work', route: '/convocatorias' },
    this.workspaceItem(),
    { label: 'Marketplace', icon: 'storefront', route: '/marketplace' },
    { label: 'Configuración', icon: 'settings', route: '/settings' },
  ]);

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
