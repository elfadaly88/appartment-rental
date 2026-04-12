import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface GuestBooking {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyThumbnailUrl?: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** ISO timestamp when host approved – used to compute 24-h payment deadline */
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

export type BookingStatus = 1 | 2 | 3 | 4 | 5 | 6 | 7;
// 1=Pending  2=Confirmed  3=Cancelled  4=Completed  5=HostBlocked  6=Approved  7=Expired

export type PaymentStatus = 1 | 2 | 3;
// 1=Pending  2=Paid  3=Failed

@Injectable({ providedIn: 'root' })
export class GuestBookingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/bookings`;

  getMyBookings(): Observable<GuestBooking[]> {
    return this.http.get<GuestBooking[]>(`${this.url}/my-bookings`);
  }

  cancelBooking(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}/cancel`);
  }
}
