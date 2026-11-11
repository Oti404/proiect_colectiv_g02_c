import { Routes } from '@angular/router';
import { demoAuthGuard } from './core/guards/demo-auth.guard';
import { demoGuestGuard } from './core/guards/demo-guest.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'search',
  },
  {
    path: 'login',
    canActivate: [demoGuestGuard],
    loadComponent: () =>
      import('./features/auth/login-page').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    canActivate: [demoGuestGuard],
    loadComponent: () =>
      import('./features/auth/register-page').then((m) => m.RegisterPageComponent),
  },
  {
    path: 'search',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/search/search-page').then((m) => m.SearchPageComponent),
  },
  {
    path: 'dogs/:id',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/dogs/dog-detail-page').then((m) => m.DogDetailPageComponent),
  },
  {
    path: 'profile',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/profile/profile-page').then((m) => m.ProfilePageComponent),
  },
  {
    path: 'users/:id',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/profile/user-profile-page').then((m) => m.UserProfilePageComponent),
  },
  {
    path: 'events',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/events/events-page').then((m) => m.EventsPageComponent),
  },
  {
    path: 'events/new',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/events/event-form-page').then((m) => m.EventFormPageComponent),
  },
  {
    path: 'events/:id',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/events/event-detail-page').then((m) => m.EventDetailPageComponent),
  },
  {
    path: 'events/:id/edit',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/events/event-form-page').then((m) => m.EventFormPageComponent),
  },
  {
    path: 'messages',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/messages/messages-page').then((m) => m.MessagesPageComponent),
  },
  {
    path: 'messages/:id',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/messages/messages-page').then((m) => m.MessagesPageComponent),
  },
  {
    path: 'care',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/care/care-page').then((m) => m.CarePageComponent),
  },
  {
    path: 'feed',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/feed/feed-page').then((m) => m.FeedPageComponent),
  },
  {
    path: 'map',
    canActivate: [demoAuthGuard],
    loadComponent: () =>
      import('./features/places/places-map-page').then((m) => m.PlacesMapPageComponent),
  },
  {
    path: '**',
    redirectTo: 'search',
  },
];
