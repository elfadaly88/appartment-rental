import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HostBooking, HostProperty, HostService } from '../services/host.service';

@Injectable({ providedIn: 'root' })
export class HostStore {
  private readonly hostService = inject(HostService);

  private readonly _myProperties = signal<HostProperty[]>([]);
  private readonly _myBookings = signal<HostBooking[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly myProperties = this._myProperties.asReadonly();
  readonly myBookings = this._myBookings.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly totalEarnings = computed(() =>
    this._myBookings().reduce((sum, booking) => sum + booking.totalPrice, 0),
  );

  readonly activeBookingsCount = computed(
    () => this._myBookings().filter((booking) => booking.status === 'active').length,
  );

  readonly totalPropertiesCount = computed(() => this._myProperties().length);

  async loadDashboardData(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const [properties, bookings] = await Promise.all([
        firstValueFrom(this.hostService.getMyProperties()),
        firstValueFrom(this.hostService.getMyBookings()),
      ]);

      this._myProperties.set(properties);
      this._myBookings.set(bookings);
    } catch {
      this._error.set('Unable to load host dashboard data at the moment.');
    } finally {
      this._isLoading.set(false);
    }
  }
}
