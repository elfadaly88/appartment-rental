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

// التعديل هنا: بنستقبل token بدل checkoutUrl عشان يطابق الباك إند
export interface InitiatePaymentResponseDto {
  token: string;
  bookingSummary?: BookingCheckoutSummaryDto;
}

@Injectable({ providedIn: 'root' })
export class CheckoutStore {
  private readonly http = inject(HttpClient);

  private readonly _iframeUrl = signal<string | null>(null);
  private readonly _summary = signal<BookingCheckoutSummaryDto | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly iframeUrl = this._iframeUrl.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasIframeUrl = computed(() => !!this._iframeUrl());

  async initiatePayment(bookingId: string): Promise<void> {
    if (!bookingId) {
      this._error.set('Missing booking id.');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    this._iframeUrl.set(null);

    try {
      // المسار المظبوط اللي في الكنترولر بتاعك
      const url = `${environment.apiUrl}/payments/paymob/initiate`;

      console.log(
        '[CheckoutStore] initiatePayment - Sending request to:',
        url
      );

      const response = await firstValueFrom(
        this.http.post<InitiatePaymentResponseDto>(url, { bookingId }),
      );

      if (!response?.token) {
        throw new Error('Payment token was not returned by API.');
      }

      // بناء رابط الايفريم باستخدام التوكن الراجع من الباك إند
      // الـ 849553 ده الـ Test Iframe ID بتاعك
      const iframeId = '849553';
      const fullUrl = `https://egypt.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${response.token}`;

      this._iframeUrl.set(fullUrl);
      this._summary.set(response.bookingSummary ?? null);

    } catch (err: any) {
      console.error('[CheckoutStore] initiatePayment failed', err);
      this._error.set('Unable to generate secure payment link. Please try again.');
      this._iframeUrl.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  clear(): void {
    this._iframeUrl.set(null);
    this._summary.set(null);
    this._error.set(null);
    this._isLoading.set(false);
  }

  reset(): void {
    this.clear();
  }
}