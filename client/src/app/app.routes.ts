import { Routes } from '@angular/router';
import { authGuard } from './utils/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
    title: 'Expenses',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings',
  },
  {
    path: 'settings/categories',
    loadComponent: () =>
      import('./settings/categories/categories.component').then(
        (m) => m.CategoriesComponent
      ),
    canActivate: [authGuard],
    title: 'Categories',
  },
];
