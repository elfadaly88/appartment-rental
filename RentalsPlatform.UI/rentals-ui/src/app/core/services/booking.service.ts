import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface CreateBookingDto {
  propertyId: string;
  guestId: string; // في الواقع هنجيبه من التوكن، بس حالياً هنبعته
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string;
}

export interface BookingResponse {
  id: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/bookings`;

  createBooking(payload: CreateBookingDto) {
    return this.http.post<BookingResponse>(this.apiUrl, payload);
  }
}
