import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'search',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-page').then((m) => m.RegisterPageComponent),
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/search/search-page').then((m) => m.SearchPageComponent),
  },
  {
    path: 'dogs/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dogs/dog-detail-page').then((m) => m.DogDetailPageComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-page').then((m) => m.ProfilePageComponent),
  },
  {
    path: 'users/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/user-profile-page').then((m) => m.UserProfilePageComponent),
  },
  {
    path: 'events',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/events/events-page').then((m) => m.EventsPageComponent),
  },
  {
    path: 'events/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/events/event-form-page').then((m) => m.EventFormPageComponent),
  },
  {
    path: 'events/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/events/event-detail-page').then((m) => m.EventDetailPageComponent),
  },
  {
    path: 'events/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/events/event-form-page').then((m) => m.EventFormPageComponent),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/messages/messages-page').then((m) => m.MessagesPageComponent),
  },
  {
    path: 'messages/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/messages/messages-page').then((m) => m.MessagesPageComponent),
  },
  {
    path: 'care',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/care/care-page').then((m) => m.CarePageComponent),
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/feed/feed-page').then((m) => m.FeedPageComponent),
  },
  {
    path: 'map',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/places/places-map-page').then((m) => m.PlacesMapPageComponent),
  },
  {
    path: '**',
    redirectTo: 'search',
  },
];
