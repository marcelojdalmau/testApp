import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./profile-view/profile-view.component').then(m => m.ProfileViewComponent),
  },
  {
    path: 'athlete/:id',
    loadComponent: () => import('./athlete-profile/athlete-profile.component').then(m => m.AthleteProfileComponent),
  },
  {
    path: 'professional/:id',
    loadComponent: () => import('./professional-profile/professional-profile.component').then(m => m.ProfessionalProfileComponent),
  },
  {
    path: 'club/:id',
    loadComponent: () => import('./club-profile/club-profile.component').then(m => m.ClubProfileComponent),
  },
  {
    path: 'club/:clubId/division/:divisionId',
    loadComponent: () => import('./division-detail/division-detail.component').then(m => m.DivisionDetailComponent),
  },
];
