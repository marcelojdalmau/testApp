import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'role-select',
    loadComponent: () => import('./role-select/role-select.component').then(m => m.RoleSelectComponent),
  },
  {
    path: 'create-profile',
    loadComponent: () => import('./create-profile/create-profile.component').then(m => m.CreateProfileComponent),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
