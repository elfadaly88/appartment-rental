import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  computed,
  output,
  OnInit,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PropertyStore } from '../../core/state/property.store';
import { LanguageService } from '../../core/services/language.service';
import { BookingPayload } from '../../models/property.model';

@Component({
  selector: 'app-property-detail',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './property-detail.html',
  styleUrl: './property-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
  },
})
export class PropertyDetail implements OnInit {
  /** Bound from route param via `withComponentInputBinding()` */
  readonly id = input.required<string>();

  /** Signal output for booking events */
  readonly book = output<BookingPayload>();

  protected readonly store = inject(PropertyStore);
  protected readonly lang = inject(LanguageService);
  private readonly fb = inject(FormBuilder);

  // ── Selectors ───────────────────────────────────────────────────────────

  protected readonly property = computed(() =>
    this.store.properties().find((p) => p.id === this.id()) ?? null,
  );

  protected readonly name = computed(() => {
    const prop = this.property();
    return prop ? prop.name[this.lang.currentLang()] : '';
  });

  protected readonly address = computed(() => {
    const prop = this.property();
    return prop ? prop.address[this.lang.currentLang()] : '';
  });

  protected readonly description = computed(() => {
    const prop = this.property();
    return prop?.description?.[this.lang.currentLang()] ?? '';
  });

  protected readonly mapUrl = computed(() => this.property()?.address.mapUrl ?? '');

  protected readonly heroImage = computed(() => this.property()?.imageUrl ?? '');

  protected readonly formattedPrice = computed(() => {
    const prop = this.property();
    if (!prop) return '';
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: prop.price.currency,
        maximumFractionDigits: 0,
      }).format(prop.price.amount);
    } catch {
      return `${prop.price.currency} ${prop.price.amount.toLocaleString()}`;
    }
  });

  protected readonly amenities = computed(() => {
    const prop = this.property();
    if (!prop?.amenities) return [];
    const l = this.lang.currentLang();
    return prop.amenities.map((a) => a[l]);
  });

  protected readonly gallery = computed(() => {
    const prop = this.property();
    if (!prop?.gallery?.length) return [];
    const l = this.lang.currentLang();
    return prop.gallery.map((img) => ({ url: img.url, alt: img.alt[l] }));
  });

  protected readonly stats = computed(() => {
    const prop = this.property();
    if (!prop) return [];
    const isAr = this.lang.currentLang() === 'ar';
    const items: { icon: string; label: string; value: string }[] = [];
    if (prop.bedrooms != null) {
      items.push({
        icon: 'bed',
        label: isAr ? 'غرف النوم' : 'Bedrooms',
        value: String(prop.bedrooms),
      });
    }
    if (prop.bathrooms != null) {
      items.push({
        icon: 'bath',
        label: isAr ? 'الحمامات' : 'Bathrooms',
        value: String(prop.bathrooms),
      });
    }
    if (prop.area != null) {
      items.push({
        icon: 'area',
        label: isAr ? 'المساحة' : 'Area',
        value: isAr
          ? `${prop.area.toLocaleString('ar-SA')} م²`
          : `${prop.area.toLocaleString('en-US')} m²`,
      });
    }
    return items;
  });

  // ── Booking Form ────────────────────────────────────────────────────────

  protected readonly bookingForm: FormGroup;
  protected readonly today: string;

  constructor() {
    const now = new Date();
    this.today = now.toISOString().split('T')[0];

    this.bookingForm = this.fb.nonNullable.group({
      checkIn: [this.today, Validators.required],
      checkOut: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Ensure properties are loaded (in case the user navigates directly to detail)
    this.store.loadProperties();
  }

  // ── i18n Helpers ────────────────────────────────────────────────────────

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  protected onBook(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    const { checkIn, checkOut } = this.bookingForm.getRawValue();
    this.book.emit({
      propertyId: this.id(),
      checkIn,
      checkOut,
    });
  }
}
