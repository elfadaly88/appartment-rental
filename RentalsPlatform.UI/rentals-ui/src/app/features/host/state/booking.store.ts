import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface HostBooking {
  id: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  guestEmail?: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
}

@Injectable({ providedIn: 'root' })
export class BookingStore {
  private readonly http = inject(HttpClient);

  private readonly _bookings = signal<HostBooking[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _actionInFlightIds = signal<Set<string>>(new Set<string>());

  readonly bookings = this._bookings.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly pendingRequests = computed(() =>
    this._bookings()
      .filter((booking) => booking.status === 'pending')
      .sort((a, b) => Date.parse(a.checkInDate) - Date.parse(b.checkInDate)),
  );

  readonly upcomingBookings = computed(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return this._bookings()
      .filter((booking) => {
        const checkIn = new Date(booking.checkInDate);
        checkIn.setHours(0, 0, 0, 0);
        return (
          (booking.status === 'approved' || booking.status === 'active') &&
          checkIn.getTime() >= now.getTime()
        );
      })
      .sort((a, b) => Date.parse(a.checkInDate) - Date.parse(b.checkInDate));
  });

  readonly pastBookings = computed(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return this._bookings()
      .filter((booking) => {
        const checkOut = new Date(booking.checkOutDate);
        checkOut.setHours(0, 0, 0, 0);

        if (
          booking.status === 'completed' ||
          booking.status === 'rejected' ||
          booking.status === 'cancelled'
        ) {
          return true;
        }

        return checkOut.getTime() < now.getTime();
      })
      .sort((a, b) => Date.parse(b.checkOutDate) - Date.parse(a.checkOutDate));
  });

  async loadBookings(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<HostBooking[]>(`${environment.apiUrl}/host/bookings`),
      );
      this._bookings.set(response ?? []);
    } catch {
      this._error.set('Unable to load bookings at the moment.');
    } finally {
      this._isLoading.set(false);
    }
  }

  async approveBooking(id: string): Promise<void> {
    const previous = this._bookings().find((booking) => booking.id === id);
    if (!previous || this.isActionInProgress(id)) {
      return;
    }

    this.markActionInFlight(id, true);
    this.patchBookingStatus(id, 'approved');

    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/host/bookings/${encodeURIComponent(id)}/approve`, {}));
    } catch {
      this.patchBookingStatus(id, previous.status);
      this._error.set('Failed to approve booking. Please retry.');
    } finally {
      this.markActionInFlight(id, false);
    }
  }

  async rejectBooking(id: string): Promise<void> {
    const previous = this._bookings().find((booking) => booking.id === id);
    if (!previous || this.isActionInProgress(id)) {
      return;
    }

    this.markActionInFlight(id, true);
    this.patchBookingStatus(id, 'rejected');

    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/host/bookings/${encodeURIComponent(id)}/reject`, {}));
    } catch {
      this.patchBookingStatus(id, previous.status);
      this._error.set('Failed to reject booking. Please retry.');
    } finally {
      this.markActionInFlight(id, false);
    }
  }

  isActionInProgress(id: string): boolean {
    return this._actionInFlightIds().has(id);
  }

  private patchBookingStatus(id: string, status: BookingStatus): void {
    this._bookings.update((current) =>
      current.map((booking) =>
        booking.id === id ? { ...booking, status } : booking,
      ),
    );
  }

  private markActionInFlight(id: string, inFlight: boolean): void {
    this._actionInFlightIds.update((current) => {
      const next = new Set(current);
      if (inFlight) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
