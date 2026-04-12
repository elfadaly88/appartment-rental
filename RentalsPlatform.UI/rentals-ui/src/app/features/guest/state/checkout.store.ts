import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CheckoutPriceLineDto {
  label: string;
  amount: number;
}

export interface BookingCheckoutSummaryDto {
  bookingId: string;
  propertyName: string;
  propertyImageUrl: string;
  hostName: string;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  totalAmount: number;
  breakdown: CheckoutPriceLineDto[];
}

export interface InitiatePaymentResponseDto {
  checkoutUrl: string;
  bookingSummary?: BookingCheckoutSummaryDto;
}

@Injectable({ providedIn: 'root' })
export class CheckoutStore {
  private readonly http = inject(HttpClient);

  private readonly _checkoutUrl = signal<string | null>(null);
  private readonly _summary = signal<BookingCheckoutSummaryDto | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly checkoutUrl = this._checkoutUrl.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasCheckoutUrl = computed(() => !!this._checkoutUrl());

  async initiatePayment(bookingId: string): Promise<void> {
    if (!bookingId) {
      this._error.set('Missing booking id.');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    this._checkoutUrl.set(null);

    try {
      const url = `${environment.apiUrl}/payments/paymob/initiate`;
      const response = await firstValueFrom(
        this.http.post<InitiatePaymentResponseDto>(url, { bookingId }),
      );

      if (!response?.checkoutUrl) {
        throw new Error('Payment URL was not returned by API.');
      }

      this._checkoutUrl.set(response.checkoutUrl);
      this._summary.set(response.bookingSummary ?? null);

    } catch (err) {
      console.error('[CheckoutStore] initiatePayment failed', err);
      this._error.set('Unable to generate secure payment link. Please try again.');
      this._checkoutUrl.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  clear(): void {
    this._checkoutUrl.set(null);
    this._summary.set(null);
    this._error.set(null);
    this._isLoading.set(false);
  }

  reset(): void {
    this.clear();
  }
}