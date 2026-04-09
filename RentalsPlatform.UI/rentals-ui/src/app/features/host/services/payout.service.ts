import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

export type PayoutMethod = 'bank' | 'wallet';

export interface SavePayoutDetailsDto {
  payoutMethod: PayoutMethod;
  beneficiaryName?: string;
  bankName?: string;
  iban?: string;
  walletNumber?: string;
}

export interface PayoutSetupStatus {
  isSetupComplete: boolean;
  subMerchantId: string | null;
  payoutMethod: PayoutMethod | null;
  maskedAccount: string | null;
}

export interface PayoutSetupResponseDto {
  isSetupComplete: boolean;
  subMerchantId: string | null;
  payoutMethod: PayoutMethod;
  maskedAccount?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PayoutService {
  private readonly http = inject(HttpClient);

  readonly status = signal<PayoutSetupStatus>({
    isSetupComplete: false,
    subMerchantId: null,
    payoutMethod: null,
    maskedAccount: null,
  });

  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);

  async saveBankDetails(payload: SavePayoutDetailsDto): Promise<void> {
    this.isSaving.set(true);
    this.error.set(null);

    try {
      const url = `${environment.apiUrl}/host/bank-details`;
      const response = await firstValueFrom(
        this.http.post<PayoutSetupResponseDto>(url, payload),
      );

      this.status.set({
        isSetupComplete: response.isSetupComplete,
        subMerchantId: response.subMerchantId,
        payoutMethod: response.payoutMethod,
        maskedAccount: response.maskedAccount ?? this.maskAccount(payload),
      });
    } catch (err) {
      console.error('[PayoutService] saveBankDetails failed', err);
      this.error.set('Unable to save payout details. Please try again.');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  resetError(): void {
    this.error.set(null);
  }

  private maskAccount(payload: SavePayoutDetailsDto): string {
    if (payload.payoutMethod === 'bank' && payload.iban) {
      const compact = payload.iban.replace(/\s+/g, '');
      const suffix = compact.slice(-4);
      return `EG ******* ${suffix}`;
    }

    if (payload.payoutMethod === 'wallet' && payload.walletNumber) {
      const suffix = payload.walletNumber.slice(-4);
      return `01******${suffix}`;
    }

    return '****';
  }
}
