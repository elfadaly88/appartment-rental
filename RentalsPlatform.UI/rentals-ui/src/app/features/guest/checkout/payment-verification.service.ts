import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface VerifyBookingPaymentResponse {
  bookingId: string;
  status: string;
  paymentStatus: string;
  paymentId?: string | null;
  callbackSuccessHint: boolean;
  isVerified: boolean;
}

@Injectable({ providedIn: 'root' })
export class PaymentVerificationService {
  private readonly http = inject(HttpClient);

  async verifyBookingPayment(bookingId: string, successHint: boolean): Promise<VerifyBookingPaymentResponse> {
    return firstValueFrom(
      this.http.post<VerifyBookingPaymentResponse>(
        `${environment.apiUrl}/bookings/verify-payment-status`,
        { bookingId, success: successHint },
      ),
    );
  }
}
