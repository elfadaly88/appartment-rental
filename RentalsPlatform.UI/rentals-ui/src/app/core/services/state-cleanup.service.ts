import { Injectable, inject } from '@angular/core';
import { AdminDashboardStore } from '../../features/admin/state/admin-dashboard.store';
import { AdminUserStore } from '../../features/admin/state/admin-user.store';
import { AdminPropertyStore } from '../../features/admin/state/admin-property.store';
import { HostStore } from '../../features/host/state/host.store';
import { BookingStore } from '../../features/host/state/booking.store';
import { AnalyticsStore } from '../../features/host/state/analytics.store';
import { SearchStore } from '../../features/guest/state/search.store';
import { CheckoutStore } from '../../features/guest/state/checkout.store';
import { PropertyStore } from '../state/property.store';
import { NotificationStore } from '../state/notification.store';

@Injectable({ providedIn: 'root' })
export class StateCleanupService {
  private readonly adminDashboardStore = inject(AdminDashboardStore);
  private readonly adminUserStore = inject(AdminUserStore);
  private readonly adminPropertyStore = inject(AdminPropertyStore);
  private readonly hostStore = inject(HostStore);
  private readonly bookingStore = inject(BookingStore);
  private readonly analyticsStore = inject(AnalyticsStore);
  private readonly searchStore = inject(SearchStore);
  private readonly checkoutStore = inject(CheckoutStore);
  private readonly propertyStore = inject(PropertyStore);
  private readonly notificationStore = inject(NotificationStore);

  /**
   * Resets all application state stores to their initial state.
   * Should be called when user logs out.
   */
  resetAllStores(): void {
    this.adminDashboardStore.reset();
    this.adminUserStore.reset();
    this.adminPropertyStore.reset();
    this.hostStore.reset();
    this.bookingStore.reset();
    this.analyticsStore.reset();
    this.searchStore.reset();
    this.checkoutStore.reset();
    this.propertyStore.reset();
    this.notificationStore.reset();
  }
}
