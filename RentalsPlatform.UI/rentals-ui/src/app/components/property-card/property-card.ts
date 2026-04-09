import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { Property } from '../../models/property.model';

@Component({
  selector: 'app-property-card',
  templateUrl: './property-card.html',
  styleUrl: './property-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyCard {
  readonly property = input.required<Property>();
  readonly locale = input<'ar' | 'en'>('en');

  protected readonly name = computed(() => {
    const lang = this.locale();
    return this.property().name[lang];
  });

  protected readonly address = computed(() => {
    const lang = this.locale();
    return this.property().address[lang];
  });

  protected readonly formattedPrice = computed(() => {
    const { amount, currency } = this.property().price;
    const lang = this.locale();
    try {
      return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  });

  protected readonly mapUrl = computed(() => this.property().address.mapUrl);
  protected readonly imageUrl = computed(() => this.property().imageUrl);
  protected readonly imageAlt = computed(() => this.name());
  protected readonly mapLabel = computed(() =>
    this.locale() === 'ar' ? 'عرض على الخريطة' : 'View on Map'
  );
}
