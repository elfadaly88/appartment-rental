import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/services/language.service';
import { SearchStore, ViewMode } from '../state/search.store';

@Component({
  selector: 'app-guest-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './guest-search.component.html',
  styleUrl: './guest-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class GuestSearchComponent implements OnInit {
  readonly initialViewMode = input<ViewMode>('list');
  readonly propertySelected = output<string>();

  protected readonly lang = inject(LanguageService);
  protected readonly searchStore = inject(SearchStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly isFilterSheetOpen = signal(false);
  protected readonly cityInput = signal('');

  protected readonly cityOptions = [
    'Dubai',
    'Abu Dhabi',
    'Riyadh',
    'Jeddah',
    'Cairo',
    'Paris',
    'London',
    'Maldives',
    'Ibiza',
  ];

  protected readonly filterForm = this.fb.group({
    city: this.fb.control('', { validators: [Validators.maxLength(60)] }),
    checkIn: this.fb.control(''),
    checkOut: this.fb.control(''),
    minPrice: this.fb.control(0),
    maxPrice: this.fb.control(15000),
    guests: this.fb.control(1, [Validators.min(1), Validators.max(20)]),
  });

  protected readonly filteredCityOptions = computed(() => {
    const query = this.cityInput().trim().toLowerCase();
    if (!query) return this.cityOptions;
    return this.cityOptions.filter((city) => city.toLowerCase().includes(query));
  });

  protected readonly viewModeLabel = computed(() =>
    this.searchStore.viewMode() === 'list'
      ? this.t('عرض الخريطة', 'Map View')
      : this.t('عرض القائمة', 'List View'),
  );

  ngOnInit(): void {
    this.searchStore.setViewMode(this.initialViewMode());

    const criteria = this.searchStore.searchCriteria();
    this.filterForm.patchValue(criteria, { emitEvent: false });
    this.cityInput.set(criteria.city);

    this.filterForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.searchStore.updateFilters({
          city: value.city ?? '',
          checkIn: value.checkIn ?? '',
          checkOut: value.checkOut ?? '',
          minPrice: Number(value.minPrice ?? 0),
          maxPrice: Number(value.maxPrice ?? 15000),
          guests: Number(value.guests ?? 1),
        });
      });
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected updateCityInput(value: string): void {
    this.cityInput.set(value);
    this.filterForm.controls.city.setValue(value);
  }

  protected pickCity(city: string): void {
    this.cityInput.set(city);
    this.filterForm.controls.city.setValue(city);
  }

  protected openFilterSheet(): void {
    this.isFilterSheetOpen.set(true);
  }

  protected closeFilterSheet(): void {
    this.isFilterSheetOpen.set(false);
  }

  protected toggleViewMode(): void {
    this.searchStore.toggleViewMode();
  }

  protected selectProperty(id: string): void {
    this.propertySelected.emit(id);
  }

  protected propertyName(property: { name: { ar: string; en: string } }): string {
    return this.lang.currentLang() === 'ar' ? property.name.ar : property.name.en;
  }

  protected propertyAddress(property: { address: { ar: string; en: string } }): string {
    return this.lang.currentLang() === 'ar' ? property.address.ar : property.address.en;
  }

  protected formatPrice(amount: number, currency: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }
}
