import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { Property } from '../../models/property.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-property-card',
  imports: [TranslateModule],
  templateUrl: './property-card.html',
  styleUrl: './property-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyCard {
  readonly property = input.required<Property>();
  readonly locale = input<'ar' | 'en'>('en');
  readonly clicked = output<string>();

  protected readonly name = computed(() => {
    const lang = this.locale();
    return this.property().name[lang];
  });

  protected readonly address = computed(() => {
    const lang = this.locale();
    return this.property().address[lang];
  });

  protected readonly formattedPrice = computed(() => {
    const price = this.property()?.price;
    const amount = price?.amount ?? 0;
    const currency = price?.currency || 'EGP';
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
}
