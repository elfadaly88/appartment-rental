import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminFinancialSummaryDto {
  totalRevenue: number;
  activeUsers: number;
  pendingApprovals: number;
}

export interface AdminBookingDto {
  id: string;
  propertyId: string;
  propertyTitle: string;
  hostName: string;
  guestEmail: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: string;
  bookingStatus: string;
  paymentStatus: string;
  isPaid: boolean;
  paymentProvider: string;
  transactionId?: string;
  createdOnUtc: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  getPendingProperties(): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.baseUrl}/properties/pending`);
  }

  approveProperty(id: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/properties/${encodeURIComponent(id)}/approve`, {});
  }

  getAllBookings(): Observable<AdminBookingDto[]> {
    return this.http.get<AdminBookingDto[]>(`${this.baseUrl}/bookings`);
  }

  getFinancialSummary(): Observable<AdminFinancialSummaryDto> {
    return this.http.get<AdminFinancialSummaryDto>(`${this.baseUrl}/financial-summary`);
  }
}
