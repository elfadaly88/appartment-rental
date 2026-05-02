import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BlockDatesPayload {
  propertyId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export type HostCalendarEntryType = 'booking' | 'blocked' | 'seasonal';

export interface HostCalendarEntry {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  type: HostCalendarEntryType;
  deletable?: boolean;
  guestName?: string;
  note?: string;
  label?: string;
  customPrice?: number;
}

export interface BookingQuote {
  isAvailable: boolean;
  unavailabilityReason?: string | null;
  totalNights: number;
  regularNights: number;
  regularRatePerNight: number;
  seasonalGroups: SeasonalGroup[];
  subTotal: number;
  feesTotal: number;
  totalAmount: number;
  currency: string;
  discountAmount: number;
  discountLabel?: string | null;
}

export interface SeasonalGroup {
  label: string;
  nights: number;
  ratePerNight: number;
  groupTotal: number;
}

@Injectable({ providedIn: 'root' })
export class HostBookingService {
  private readonly http = inject(HttpClient);

  /** Returns typed calendar ranges (booking | blocked | seasonal) for the host calendar UI. */
  getTakenDates(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Observable<HostCalendarEntry[]> {
    return this.http.get<HostCalendarEntry[]>(
      `${environment.apiUrl}/host/properties/${encodeURIComponent(propertyId)}/calendar/taken-dates`,
      { params: { startDate, endDate } },
    );
  }

  /**
   * Blocks a date range via the new host calendar endpoint.
   * Returns a CalendarEntryDto so the UI can optimistically update with the real ID.
   */
  blockDates(payload: {
    propertyId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }): Observable<HostCalendarEntry> {
    return this.http.post<HostCalendarEntry>(
      `${environment.apiUrl}/host/properties/${encodeURIComponent(payload.propertyId)}/calendar/block`,
      { startDate: payload.startDate, endDate: payload.endDate, reason: payload.reason ?? null },
    );
  }

  /** Removes a host-managed blocked period by its UnavailableDate ID. */
  unblockDates(propertyId: string, blockId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/host/properties/${encodeURIComponent(propertyId)}/calendar/block/${encodeURIComponent(blockId)}`,
    );
  }

  /**
   * Returns a full availability check + pricing breakdown for a guest booking quote.
   * Used by the guest BookingWidget to show the real-time invoice.
   */
  getQuote(propertyId: string, checkIn: string, checkOut: string): Observable<BookingQuote> {
    return this.http.get<BookingQuote>(
      `${environment.apiUrl}/calendar/properties/${encodeURIComponent(propertyId)}/quote`,
      { params: { checkIn, checkOut } },
    );
  }
}
