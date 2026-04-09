import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { PLATFORM_ID } from '@angular/core';

import { CheckoutStore } from '../state/checkout.store';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-paymob-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paymob-checkout.component.html',
  styleUrl: './paymob-checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PaymobCheckoutComponent {
  protected readonly store = inject(CheckoutStore);
  protected readonly route = inject(ActivatedRoute);
  protected readonly lang = inject(LanguageService);
  protected readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly bookingIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('bookingId') ?? '')),
    { initialValue: '' },
  );

  constructor() {
    const bookingId = this.bookingIdParam();
    if (bookingId) {
      void this.beginRedirect(bookingId);
    } else {
      this.store.clear();
    }

    this.destroyRef.onDestroy(() => {
      this.store.clear();
    });
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected retryRedirect(): void {
    const bookingId = this.bookingIdParam();
    if (!bookingId) {
      return;
    }

    void this.beginRedirect(bookingId);
  }

  private async beginRedirect(bookingId: string): Promise<void> {
    await this.store.initiatePayment(bookingId);

    const redirectUrl = this.store.checkoutUrl();
    if (!redirectUrl) {
      return;
    }

    // Unified Checkout flow: hard redirect to Paymob checkout page.
    if (isPlatformBrowser(this.platformId)) {
      window.location.href = redirectUrl;
    }
  }
}
