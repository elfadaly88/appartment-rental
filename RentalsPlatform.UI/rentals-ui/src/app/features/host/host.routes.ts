import { Routes } from '@angular/router';
import { propertyEditResolver } from './properties/property-edit.resolver';

export const HOST_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/host-dashboard.component').then(
        (m) => m.HostDashboardComponent,
      ),
  },
  {
    path: 'properties/new',
    loadComponent: () =>
      import('./properties/property-form.component').then(
        (m) => m.PropertyFormComponent,
      ),
  },
  {
    path: 'properties/:id/edit',
    loadComponent: () =>
      import('./properties/edit-property.component').then(
        (m) => m.EditPropertyComponent,
      ),
    resolve: {
      property: propertyEditResolver,
    },
  },
  {
    path: 'bookings',
    loadComponent: () =>
      import('./bookings/booking-management.component').then(
        (m) => m.BookingManagementComponent,
      ),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar/property-calendar.component').then(
        (m) => m.PropertyCalendarComponent,
      ),
  },
  {
    path: 'block-dates',
    loadComponent: () =>
      import('./block-dates/block-dates.component').then(
        (m) => m.BlockDatesComponent,
      ),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];