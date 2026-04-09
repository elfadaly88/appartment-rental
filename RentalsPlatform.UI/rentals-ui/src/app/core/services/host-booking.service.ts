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

export type HostCalendarEntryType = 'booking' | 'blocked';

export interface HostCalendarEntry {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  type: HostCalendarEntryType;
  guestName?: string;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class HostBookingService {
  private readonly http = inject(HttpClient);

  getTakenDates(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Observable<HostCalendarEntry[]> {
    return this.http.get<HostCalendarEntry[]>(
      `${environment.apiUrl}/host/properties/${encodeURIComponent(propertyId)}/calendar/taken-dates`,
      {
        params: {
          startDate,
          endDate,
        },
      },
    );
  }

  blockDates(payload: BlockDatesPayload): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/bookings/block-dates`, payload);
  }
}
