import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  { path: 'login', redirectTo: 'auth', pathMatch: 'full' },
  {
    path: 'properties',
    loadComponent: () =>
      import('./pages/properties-page/properties-page').then(
        (m) => m.PropertiesPage,
      ),
  },
  {
    path: 'properties/:id',
    loadComponent: () =>
      import('./components/property-detail/property-detail.component').then(
        (m) => m.PropertyDetailComponent,
      ),
  },
  {
    path: 'checkout/:bookingId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/guest/checkout/paymob-checkout.component').then(
        (m) => m.PaymobCheckoutComponent,
      ),
  },
  {
    path: 'checkout/callback',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/guest/checkout/payment-callback.component').then(
        (m) => m.PaymentCallbackComponent,
      ),
  },
  {
    path: 'receipt/:bookingId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/guest/receipt/booking-receipt.component').then(
        (m) => m.BookingReceiptComponent,
      ),
  },
  {
    path: 'chat/:bookingId/:otherParticipantId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/chat/chat-window.component').then(
        (m) => m.ChatWindowComponent,
      ),
  },
  {
    path: 'host/dashboard',
    canActivate: [authGuard, roleGuard(['host', 'admin'])],
    loadComponent: () =>
      import('./features/host/dashboard/host-dashboard.component').then(
        (m) => m.HostDashboardComponent,
      ),
  },
  {
    path: 'host/properties/new',
    canActivate: [authGuard, roleGuard(['host', 'admin'])],
    loadComponent: () =>
      import('./features/properties/add-property/add-property.component').then(
        (m) => m.AddPropertyComponent,
      ),
  },
  {
    path: 'host/block-dates',
    canActivate: [authGuard, roleGuard(['host', 'admin'])],
    loadComponent: () =>
      import('./features/host/block-dates/block-dates.component').then(
        (m) => m.BlockDatesComponent,
      ),
  },
  { path: '', redirectTo: 'properties', pathMatch: 'full' },
  { path: '**', redirectTo: 'properties' },
];
