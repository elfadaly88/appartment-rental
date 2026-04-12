import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type PropertyStatus = 'Pending' | 'Approved' | 'Rejected';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed' | 'HostBlocked';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed';

export interface HostPropertySummary {
  id: string;
  title: string;
  description: string;
  city: string;
  country: string;
  pricePerNight: number;
  serviceFeePercentage: number | null;
  taxPercentage: number | null;
  currency: string;
  maxGuests: number;
  status: PropertyStatus;
  thumbnailUrl: string | null;
  rejectionReason: string | null;
  submittedAt: string;
}

export interface HostBookingOverview {
  id: string;
  propertyId: string;
  propertyTitle: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
}

export type PipelineStatus = 'Pending' | 'Approved' | 'Confirmed' | 'Arriving';

export interface HostPipelineBooking {
  id: string;
  propertyId: string;
  propertyTitle: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestAvatarUrl?: string | null;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  netProfit: number;
  currency: string;
  pipelineStatus: PipelineStatus;
  /** ISO string – when the 24-h soft-block expires for Approved bookings */
  softBlockUntil?: string | null;
}

export interface HostDashboard {
  totalEarnings: number;
  projectedIncome: number;
  activeListings: number;
  occupancyRate: number;
  properties: HostPropertySummary[];
  bookings: HostBookingOverview[];
}

export interface HostPropertyImage {
  id: string;
  url: string;
  isMain: boolean;
}

export interface HostBlockedDate {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface HostPropertyDetails {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  country: string;
  city: string;
  street: string;
  zipCode: string;
  mapUrl: string;
  pricePerNight: number;
  serviceFeePercentage: number | null;
  taxPercentage: number | null;
  currency: string;
  maxGuests: number;
  status: PropertyStatus;
  rejectionReason: string | null;
  images: HostPropertyImage[];
  blockedDates: HostBlockedDate[];
}

export interface PriceRuleDto {
  id: string;
  startDate: string;
  endDate: string;
  customPrice: number;
}

export interface CreatePriceRuleDto {
  startDate: string;
  endDate: string;
  customPrice: number;
}

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/properties`;

  private readonly _dashboard = signal<HostDashboard | null>(null);
  private readonly _pipelineBookings = signal<HostPipelineBooking[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isPipelineLoading = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _uploadProgress = signal(0);
  private readonly _error = signal<string | null>(null);
  private readonly _pipelineError = signal<string | null>(null);

  readonly dashboard = this._dashboard.asReadonly();
  readonly pipelineBookings = this._pipelineBookings.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isPipelineLoading = this._isPipelineLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pipelineError = this._pipelineError.asReadonly();

  readonly properties = computed(() => this._dashboard()?.properties ?? []);
  readonly bookings = computed(() => this._dashboard()?.bookings ?? []);

  async loadDashboard(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const dashboard = await firstValueFrom(
        this.http.get<HostDashboard>(`${this.baseUrl}/host/dashboard`),
      );
      this._dashboard.set(dashboard);
    } catch {
      this._error.set('Unable to load the host dashboard.');
    } finally {
      this._isLoading.set(false);
    }
  }

  async loadPipeline(): Promise<void> {
    this._isPipelineLoading.set(true);
    this._pipelineError.set(null);

    try {
      const pipeline = await firstValueFrom(
        this.http.get<HostPipelineBooking[]>(`${environment.apiUrl}/host/bookings/pipeline`),
      );

      this._pipelineBookings.set(pipeline ?? []);
    } catch {
      this._pipelineError.set('Unable to load booking pipeline.');
      this._pipelineBookings.set([]);
    } finally {
      this._isPipelineLoading.set(false);
    }
  }

  async confirmCheckIn(bookingId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/host/bookings/${encodeURIComponent(bookingId)}/confirm-checkin`, {}),
      );
      this._pipelineBookings.update((current) =>
        current.map((b) => b.id === bookingId ? { ...b, pipelineStatus: 'Arriving' as const } : b),
      );
      return true;
    } catch {
      this._pipelineError.set('Unable to confirm check-in right now.');
      return false;
    }
  }

  async approveBooking(bookingId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/host/bookings/${encodeURIComponent(bookingId)}/approve`, {}),
      );
      this._pipelineBookings.update((current) =>
        current.map((b) => b.id === bookingId ? { ...b, pipelineStatus: 'Approved' as const } : b),
      );
      return true;
    } catch {
      this._pipelineError.set('Unable to approve booking right now.');
      return false;
    }
  }

  async rejectBooking(bookingId: string, reason: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/host/bookings/${encodeURIComponent(bookingId)}/reject`, { reason }),
      );
      // Remove from pipeline after rejection (optimistic update)
      this._pipelineBookings.update((current) => current.filter((b) => b.id !== bookingId));
      return true;
    } catch {
      this._pipelineError.set('Unable to reject booking right now.');
      return false;
    }
  }

  getHostProperties(hostId: string): Observable<HostPropertySummary[]> {
    return this.http.get<HostPropertySummary[]>(`${this.baseUrl}/host`, {
      params: { hostId },
    });
  }

  getProperty(id: string): Observable<HostPropertyDetails> {
    return this.http.get<HostPropertyDetails>(`${this.baseUrl}/host/${encodeURIComponent(id)}`);
  }

  createProperty(formData: FormData): Observable<HttpEvent<unknown>> {
    this._isSaving.set(true);
    this._uploadProgress.set(0);

    return this.http.post(`${this.baseUrl}`, formData, {
      observe: 'events',
      reportProgress: true,
    });
  }

  updateProperty(id: string, formData: FormData): Observable<HttpEvent<unknown>> {
    this._isSaving.set(true);
    this._uploadProgress.set(0);

    return this.http.put(`${this.baseUrl}/host/${encodeURIComponent(id)}`, formData, {
      observe: 'events',
      reportProgress: true,
    });
  }

  getCalendar(propertyId: string): Observable<HostBlockedDate[]> {
    return this.http.get<HostBlockedDate[]>(`${this.baseUrl}/host/${encodeURIComponent(propertyId)}/calendar`);
  }

  getPriceRules(propertyId: string): Observable<PriceRuleDto[]> {
    return this.http.get<PriceRuleDto[]>(`${this.baseUrl}/${encodeURIComponent(propertyId)}/price-rules`);
  }

  addPriceRule(propertyId: string, payload: CreatePriceRuleDto): Observable<PriceRuleDto> {
    return this.http.post<PriceRuleDto>(`${this.baseUrl}/${encodeURIComponent(propertyId)}/price-rules`, payload);
  }

  removePriceRule(propertyId: string, ruleId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(propertyId)}/price-rules/${encodeURIComponent(ruleId)}`);
  }

  trackUpload(event: HttpEvent<unknown>): void {
    if (event.type === HttpEventType.UploadProgress && event.total) {
      this._uploadProgress.set(Math.round((event.loaded / event.total) * 100));
    }

    if (event.type === HttpEventType.Response) {
      this._isSaving.set(false);
      this._uploadProgress.set(100);
    }
  }

  resetSaveState(): void {
    this._isSaving.set(false);
    this._uploadProgress.set(0);
  }
}