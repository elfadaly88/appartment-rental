import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { LanguageService } from '../../../core/services/language.service';
import { BookingQuote } from '../../../core/services/host-booking.service';
import { PriceTagComponent } from '../../../shared/components/price-tag/price-tag.component';

/**
 * Full price-breakdown card used on the checkout page.
 * Accepts either a rich BookingQuote (preferred) or a legacy totalPrice fallback.
 */
@Component({
  selector: 'app-price-breakdown',
  standalone: true,
  imports: [CommonModule, PriceTagComponent],
  templateUrl: './price-breakdown.component.html',
  styleUrl: './price-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PriceBreakdownComponent {
  readonly checkIn = input.required<string>();
  readonly checkOut = input.required<string>();

  /** Rich quote from the pricing engine (preferred input). */
  readonly quote = input<BookingQuote | null>(null);

  /** Legacy fallback: use when the full quote is not available. */
  readonly totalPrice = input<number>(0);
  readonly baseNightlyPrice = input<number | null>(null);
  readonly currency = input<string>('EGP');
  readonly platformFeeRate = input<number>(0.1);

  protected readonly lang = inject(LanguageService);
  protected readonly isAdjustmentExpanded = signal(false);

  // ── Derived values ───────────────────────────────────────────────

  protected readonly hasQuote = computed(() => !!this.quote());

  /** Total nights (from quote or computed from dates). */
  protected readonly totalNights = computed(() => {
    const q = this.quote();
    if (q) return q.totalNights;
    const start = new Date(this.checkIn());
    const end = new Date(this.checkOut());
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  });

  /** Nights at base rate. */
  protected readonly regularNights = computed(() => this.quote()?.regularNights ?? this.totalNights());

  /** Base rate per night. */
  protected readonly regularRate = computed(() => this.quote()?.regularRatePerNight ?? (this.baseNightlyPrice() ?? 0));

  /** Seasonal groups (empty when no quote). */
  protected readonly seasonalGroups = computed(() => this.quote()?.seasonalGroups ?? []);

  /** Sub-total before discount and fees. */
  protected readonly subTotal = computed(() => {
    const q = this.quote();
    if (q) return q.subTotal;
    const rate = this.platformFeeRate();
    const total = this.totalPrice();
    return rate >= 1 ? total : total / (1 + rate);
  });

  protected readonly feesTotal = computed(() => this.quote()?.feesTotal ?? 0);

  /** Total before discount (subTotal + fees). */
  protected readonly totalBeforeDiscount = computed(() => this.subTotal() + this.feesTotal());

  protected readonly discountAmount = computed(() => this.quote()?.discountAmount ?? 0);
  protected readonly discountLabel = computed(() => this.quote()?.discountLabel ?? null);

  protected readonly hasDiscount = computed(() => this.discountAmount() > 0);

  /** Final amount after discount. */
  protected readonly finalAmount = computed(() => {
    const q = this.quote();
    if (q) return q.totalAmount;
    return this.totalPrice();
  });

  protected readonly hasSeasonalGroups = computed(() => this.seasonalGroups().length > 0);

  protected readonly discountPercent = computed(() => {
    const total = this.totalBeforeDiscount();
    if (total <= 0) return 0;
    return Math.round((this.discountAmount() / total) * 100);
  });

  protected toggleAdjustment(): void {
    this.isAdjustmentExpanded.update((v) => !v);
  }

  protected formatCurrency(value: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency() || 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
