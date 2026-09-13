import { Routes } from '@angular/router';
import { LayoutComponent } from './core/layout/layout.component';
import { authGuard } from './core/guards/auth.guard';
import { professionalGuard } from './core/guards/professional.guard';
import { athleteGuard } from './core/guards/athlete.guard';

export const routes: Routes = [
  // Auth routes (no layout shell)
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  // Main app routes (with layout shell)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },
      {
        path: 'feed',
        loadComponent: () => import('./features/feed/feed.component').then(m => m.FeedComponent),
      },
      {
        path: 'search',
        loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent),
      },
      {
        path: 'marketplace',
        loadComponent: () => import('./features/marketplace/marketplace.component').then(m => m.MarketplaceComponent),
      },
      {
        path: 'convocatorias',
        loadComponent: () => import('./features/convocatorias/convocatorias.component').then(m => m.ConvocatoriasComponent),
      },
      {
        path: 'management',
        canActivate: [professionalGuard],
        loadComponent: () => import('./features/management/management.component').then(m => m.ManagementComponent),
      },
      {
        path: 'control-center',
        canActivate: [athleteGuard],
        loadComponent: () => import('./features/control-center/control-center.component').then(m => m.ControlCenterComponent),
      },
      {
        path: 'communication',
        loadComponent: () => import('./features/communication/communication.component').then(m => m.CommunicationComponent),
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile.routes').then(m => m.PROFILE_ROUTES),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
