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

@Component({
  selector: 'app-price-breakdown',
  standalone: true,
  imports: [CommonModule],
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
  readonly totalPrice = input.required<number>();
  readonly baseNightlyPrice = input<number | null>(null);
  readonly currency = input<string>('USD');
  readonly serviceFeeAmount = input<number | null>(null);
  readonly taxAmount = input<number | null>(null);
  readonly serviceFeeRate = input<number | null>(null);
  readonly taxRate = input<number | null>(null);
  readonly platformFeeRate = input<number | null>(null);

  protected readonly lang = inject(LanguageService);
  protected readonly isAdjustmentExpanded = signal(false);

  protected readonly totalNights = computed(() => {
    const start = new Date(this.checkIn());
    const end = new Date(this.checkOut());
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, diff || 1);
  });

  protected readonly resolvedServiceFee = computed(() => {
    const explicitAmount = this.serviceFeeAmount();
    if (explicitAmount != null) {
      return Math.max(0, explicitAmount);
    }

    const legacyRate = this.platformFeeRate() ?? 0;
    const total = this.totalPrice();
    if (legacyRate <= 0 || legacyRate >= 1 || total <= 0) {
      return 0;
    }

    const inferredSubtotal = total / (1 + legacyRate);
    return Math.max(0, total - inferredSubtotal);
  });

  protected readonly resolvedTax = computed(() => {
    const explicitAmount = this.taxAmount();
    if (explicitAmount == null) {
      return 0;
    }

    return Math.max(0, explicitAmount);
  });

  protected readonly subtotal = computed(() => {
    const total = this.totalPrice();
    const subtotal = total - this.resolvedServiceFee() - this.resolvedTax();
    return Math.max(0, subtotal);
  });

  protected readonly expectedBaseTotal = computed(() => {
    const baseNightlyPrice = this.baseNightlyPrice();
    if (baseNightlyPrice == null) {
      return null;
    }

    return baseNightlyPrice * this.totalNights();
  });

  protected readonly hasSeasonalAdjustment = computed(() => {
    const expected = this.expectedBaseTotal();
    if (expected == null) {
      return false;
    }

    return Math.abs(expected - this.subtotal()) > 0.5;
  });

  protected readonly averageNightlyRate = computed(() => this.subtotal() / this.totalNights());
  protected readonly hasServiceFee = computed(() => this.resolvedServiceFee() > 0);
  protected readonly hasTax = computed(() => this.resolvedTax() > 0);

  protected toggleAdjustment(): void {
    this.isAdjustmentExpanded.update((current) => !current);
  }

  protected formatCurrency(value: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency(),
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected percentageLabel(rate: number | null): string {
    if (rate == null || rate <= 0) {
      return '';
    }

    return `${Math.round(rate * 100)}%`;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}