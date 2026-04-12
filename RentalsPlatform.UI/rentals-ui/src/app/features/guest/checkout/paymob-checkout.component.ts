import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { PLATFORM_ID } from '@angular/core';

import { CheckoutStore } from '../state/checkout.store';
import { LanguageService } from '../../../core/services/language.service';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe'; // تأكد من استيراد الـ Pipe
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'; // استيراد الـ Sanitizer
import { effect } from '@angular/core';

@Component({
  selector: 'app-paymob-checkout',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe], // ضفنا الـ Pipe هنا عشان الـ iframe
  templateUrl: './paymob-checkout.component.html',
  styleUrl: './paymob-checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PaymobCheckoutComponent implements OnInit {
  protected readonly store = inject(CheckoutStore);
  protected readonly route = inject(ActivatedRoute);
  protected readonly lang = inject(LanguageService);
  protected readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
protected safeIframeUrl: SafeResourceUrl | null = null;
private readonly sanitizer = inject(DomSanitizer);
  private readonly bookingIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('bookingId') ?? '')),
    { initialValue: '' },
  );

  ngOnInit(): void {
    const bookingId = this.bookingIdParam();
    if (bookingId) {
      void this.beginRedirect(bookingId);
    }
  }

  constructor() {
    effect(() => {
      const url = this.store.iframeUrl();
      if (url) {
        this.safeIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      } else {
        this.safeIframeUrl = null;
      }
    });
    this.destroyRef.onDestroy(() => {
      this.store.clear();
    });
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected retryRedirect(): void {
    const bookingId = this.bookingIdParam();
    if (bookingId) {
      void this.beginRedirect(bookingId);
    }
  }

  private async beginRedirect(bookingId: string): Promise<void> {
    await this.store.initiatePayment(bookingId);

    // 💡 التعديل هنا: بنقرأ الـ iframeUrl الجديد
    const redirectUrl = this.store.iframeUrl();

    // إذا كنت تريد التحويل لصفحة خارجية (Unified Checkout)
    // if (redirectUrl && isPlatformBrowser(this.platformId)) {
    //   window.location.href = redirectUrl;
    // }
  }
}