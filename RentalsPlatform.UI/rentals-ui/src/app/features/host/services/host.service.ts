import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface HostProperty {
  id: string;
  title: string;
  location: string;
  imageUrl: string;
  pricePerNight: number;
  currency: string;
}

export interface HostBooking {
  id: string;
  propertyId: string;
  propertyTitle: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  currency: string;
  status: 'active' | 'completed' | 'cancelled';
}

@Injectable({ providedIn: 'root' })
export class HostService {
  private readonly http = inject(HttpClient);

  getMyProperties(): Observable<HostProperty[]> {
    return this.http.get<HostProperty[]>(`${environment.apiUrl}/host/properties`);
  }

  getMyBookings(): Observable<HostBooking[]> {
    return this.http.get<HostBooking[]>(`${environment.apiUrl}/host/bookings`);
  }
}
