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
  bookingId: string;
  orderId: string;
  paymentKey: string;
  publicKey: string;
  checkoutUrl: string;
  callbackUrl: string;
  bookingSummary?: BookingCheckoutSummaryDto;
}

export interface PaymobPaymentSession {
  bookingId: string;
  orderId: string;
  paymentKey: string;
  publicKey: string;
  checkoutUrl: string;
  callbackUrl: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutStore {
  private readonly http = inject(HttpClient);

  private readonly _paymentSession = signal<PaymobPaymentSession | null>(null);
  private readonly _summary = signal<BookingCheckoutSummaryDto | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly paymentSession = this._paymentSession.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasPaymentSession = computed(() => !!this._paymentSession());

  async initiatePayment(bookingId: string): Promise<void> {
    if (!bookingId) {
      this._error.set('Missing booking id.');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    this._paymentSession.set(null);

    try {
      const url = `${environment.apiUrl}/payments/paymob/initiate`;

      const response = await firstValueFrom(
        this.http.post<InitiatePaymentResponseDto>(url, { bookingId }),
      );

      if (!response?.paymentKey) {
        throw new Error('Payment token was not returned by API.');
      }

      this._paymentSession.set({
        bookingId: response.bookingId,
        orderId: response.orderId,
        paymentKey: response.paymentKey,
        publicKey: response.publicKey,
        checkoutUrl: response.checkoutUrl,
        callbackUrl: response.callbackUrl,
      });
      this._summary.set(response.bookingSummary ?? null);
    } catch (err: any) {
      console.error('[CheckoutStore] initiatePayment failed', err);
      this._error.set('Unable to generate secure payment link. Please try again.');
      this._paymentSession.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  clear(): void {
    this._paymentSession.set(null);
    this._summary.set(null);
    this._error.set(null);
    this._isLoading.set(false);
  }

  reset(): void {
    this.clear();
  }
}