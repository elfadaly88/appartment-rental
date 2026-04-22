import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { adminGuard } from './features/admin/admin.guard';

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
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'my-bookings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/guest/my-bookings/my-bookings.component').then(
        (m) => m.MyBookingsComponent,
      ),
  },
  {
    path: 'user/:id',
    loadComponent: () =>
      import('./features/profile/public-profile/public-profile.component').then((m) => m.PublicProfileComponent),
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
    path: 'checkout/:bookingId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/guest/checkout/paymob-checkout.component').then(
        (m) => m.PaymobCheckoutComponent,
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
    path: 'host',
    canActivate: [authGuard, roleGuard(['host', 'admin'])],
    loadComponent: () =>
      import('./features/host/layout/host-layout.component').then(
        (m) => m.HostLayoutComponent,
      ),
    loadChildren: () =>
      import('./features/host/host.routes').then((m) => m.HOST_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard-home.component').then(
            (m) => m.AdminDashboardHomeComponent,
          ),
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./features/admin/approvals/property-approvals.component').then(
            (m) => m.PropertyApprovalsComponent,
          ),
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/admin/bookings/admin-bookings.component').then(
            (m) => m.AdminBookingsComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/user-management.component').then(
            (m) => m.UserManagementComponent,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  {
   path: 'home',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },{ path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
