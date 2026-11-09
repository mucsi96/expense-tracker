import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    title: 'Expenses',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings',
  },
  {
    path: 'settings/categories',
    loadComponent: () =>
      import('./settings/categories/categories.component').then(
        (m) => m.CategoriesComponent
      ),
    title: 'Categories',
  },
];
