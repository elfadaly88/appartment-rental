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
  readonly platformFeeRate = input<number>(0.1);

  protected readonly lang = inject(LanguageService);
  protected readonly isAdjustmentExpanded = signal(false);

  protected readonly totalNights = computed(() => {
    const start = new Date(this.checkIn());
    const end = new Date(this.checkOut());
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, diff || 1);
  });

  protected readonly subtotal = computed(() => {
    const rate = this.platformFeeRate();
    const total = this.totalPrice();
    return rate >= 1 ? total : total / (1 + rate);
  });

  protected readonly platformFee = computed(() => {
    const amount = this.totalPrice() - this.subtotal();
    return Math.max(0, amount);
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

  protected percentageLabel(): string {
    return `${Math.round(this.platformFeeRate() * 100)}%`;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}