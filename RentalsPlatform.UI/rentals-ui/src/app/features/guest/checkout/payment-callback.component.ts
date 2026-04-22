import { ChangeDetectionStrategy, Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { LanguageService } from '../../../core/services/language.service';
import { PaymentVerificationService } from './payment-verification.service';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-callback.component.html',
  styleUrl: './payment-callback.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PaymentCallbackComponent implements OnInit {
  private static readonly VerifyRetries = 5;
  private static readonly VerifyDelayMs = 2000;

  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly paymentVerificationService = inject(PaymentVerificationService);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly lang = inject(LanguageService);
  protected readonly verifiedBookingId = signal<string | null>(null);

  protected readonly status = signal<'success' | 'failed' | 'processing'>('processing');

  private readonly successParam = toSignal(
    this.route.queryParamMap.pipe(map((q) => (q.get('success') ?? '').toLowerCase())),
    { initialValue: '' },
  );

  private readonly bookingIdParam = toSignal(
    this.route.queryParamMap.pipe(
      map((q) => q.get('bookingId') ?? q.get('merchant_order_id') ?? q.get('order') ?? ''),
    ),
    { initialValue: '' },
  );

  protected readonly messageTitle = computed(() => {
    if (this.status() === 'success') {
      return this.t('تم الدفع بنجاح', 'Payment Successful');
    }
    if (this.status() === 'failed') {
      return this.t('فشل الدفع', 'Payment Failed');
    }
    return this.t('جارٍ التحقق من حالة الدفع', 'Verifying Payment Status');
  });

  protected readonly messageBody = computed(() => {
    if (this.status() === 'success') {
      return this.t(
        'تم تأكيد عمليتك بنجاح. يمكنك الآن عرض تفاصيل الحجز.',
        'Your transaction is confirmed. You can now view booking details.',
      );
    }
    if (this.status() === 'failed') {
      return this.t(
        'لم تكتمل عملية الدفع. يمكنك إعادة المحاولة بأمان.',
        'Payment was not completed. You can safely try again.',
      );
    }
    return this.t(
      'نقوم بمعالجة النتيجة القادمة من بوابة الدفع...',
      'We are processing the response from the payment gateway...',
    );
  });

  async ngOnInit(): Promise<void> {
    const value = this.successParam();
    const successHint = value === 'true';

    const bookingIdFromCallback = this.bookingIdParam();
    const bookingId = bookingIdFromCallback || (isPlatformBrowser(this.platformId) ? sessionStorage.getItem('pendingPaymobBookingId') : '') || '';

    if (!bookingId) {
      this.status.set('failed');
      return;
    }

    this.status.set('processing');

    try {
      const response = await this.verifyWithRetry(bookingId, successHint);

      if (response.isVerified) {
        this.verifiedBookingId.set(response.bookingId);
        this.status.set('success');
        if (isPlatformBrowser(this.platformId)) {
          sessionStorage.removeItem('pendingPaymobBookingId');
        }

        await this.router.navigate(['/receipt', response.bookingId], { replaceUrl: true });
        return;
      }

      if (value === 'false') {
        this.status.set('failed');
        return;
      }

      this.status.set(response.paymentStatus === 'Pending' ? 'processing' : 'failed');
    } catch {
      this.status.set('failed');
    }
  }

  private async verifyWithRetry(bookingId: string, successHint: boolean) {
    let lastResponse = await this.paymentVerificationService.verifyBookingPayment(bookingId, successHint);

    if (lastResponse.isVerified || lastResponse.paymentStatus !== 'Pending' || !successHint) {
      return lastResponse;
    }

    for (let attempt = 0; attempt < PaymentCallbackComponent.VerifyRetries; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, PaymentCallbackComponent.VerifyDelayMs));

      lastResponse = await this.paymentVerificationService.verifyBookingPayment(bookingId, successHint);
      if (lastResponse.isVerified || lastResponse.paymentStatus !== 'Pending') {
        return lastResponse;
      }
    }

    return lastResponse;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
