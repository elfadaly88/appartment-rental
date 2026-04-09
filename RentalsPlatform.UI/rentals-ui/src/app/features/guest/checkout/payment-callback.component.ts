import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { LanguageService } from '../../../core/services/language.service';

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
export class PaymentCallbackComponent {
  protected readonly route = inject(ActivatedRoute);
  protected readonly lang = inject(LanguageService);

  protected readonly status = signal<'success' | 'failed' | 'processing'>('processing');

  private readonly successParam = toSignal(
    this.route.queryParamMap.pipe(map((q) => (q.get('success') ?? '').toLowerCase())),
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

  constructor() {
    const value = this.successParam();

    if (value === 'true') {
      this.status.set('success');
      return;
    }

    if (value === 'false') {
      this.status.set('failed');
      return;
    }

    this.status.set('processing');
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
