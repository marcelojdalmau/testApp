import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./profile-view/profile-view.component').then(m => m.ProfileViewComponent),
  },
  {
    // Destino de navegación para perfiles incompletos (register-reform Req 6.2).
    // Queda bajo el shell protegido por authGuard definido en app.routes.ts.
    // El contenido del formulario de completar perfil queda fuera de alcance.
    path: 'complete',
    loadComponent: () => import('./complete-profile/complete-profile.component').then(m => m.CompleteProfileComponent),
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
