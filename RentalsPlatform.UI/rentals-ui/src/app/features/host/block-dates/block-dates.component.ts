import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { startWith } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthStore } from '../../../core/state/auth.store';
import { Property } from '../../../models/property.model';
import {
  CreatePriceRuleDto,
  HostPropertySummary,
  PriceRuleDto,
  PropertyService as HostPropertyService,
} from '../services/property.service';
import { HostBookingService } from '../../../core/services/host-booking.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-block-dates',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './block-dates.component.html',
  styleUrl: './block-dates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class BlockDatesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);
  private readonly propertyService = inject(HostPropertyService);
  private readonly hostBookingService = inject(HostBookingService);
  private readonly translate = inject(TranslateService);
  protected readonly lang = inject(LanguageService);

  readonly isSubmitting = signal(false);
  readonly properties = signal<Property[]>([]);
  readonly selectedPropertyId = signal<string | null>(null);
  readonly priceRules = signal<PriceRuleDto[]>([]);
  readonly isRulesLoading = signal(false);
  readonly isRuleSaving = signal(false);
  readonly rulesError = signal<string | null>(null);
  readonly pendingRuleIds = signal<Set<string>>(new Set<string>());

  readonly form = this.fb.group({
    propertyId: this.fb.control<string | null>(null, [Validators.required]),
    startDate: this.fb.control('', [Validators.required]),
    endDate: this.fb.control('', [Validators.required]),
    reason: this.fb.control('', [Validators.maxLength(500)]),
  });

  readonly priceRuleForm = this.fb.group({
    startDate: this.fb.control('', [Validators.required]),
    endDate: this.fb.control('', [Validators.required]),
    customPrice: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
  });

  private readonly startDateSignal = toSignal(
    this.form.controls.startDate.valueChanges.pipe(startWith(this.form.controls.startDate.value)),
    { initialValue: this.form.controls.startDate.value },
  );

  protected readonly minEndDate = computed(() => this.startDateSignal() || this.today);
  protected readonly today = new Date().toISOString().split('T')[0];

  constructor() {
    const hostId = this.authStore.currentUser()?.id;
    if (!hostId) {
      this.properties.set([]);
      return;
    }

    this.propertyService
      .getHostProperties(hostId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hostProperties: HostPropertySummary[]) => {
          this.properties.set(
            (hostProperties ?? []).map((property: HostPropertySummary) => this.toBlockProperty(property)),
          );
        },
        error: () => this.properties.set([]),
      });

    this.form.controls.propertyId.valueChanges
      .pipe(startWith(this.form.controls.propertyId.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((propertyId) => {
        this.selectedPropertyId.set(propertyId);
        if (!propertyId) {
          this.priceRules.set([]);
          this.rulesError.set(null);
          return;
        }

        this.loadPriceRules(propertyId);
      });
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    const { propertyId, startDate, endDate, reason } = this.form.getRawValue();
    if (!propertyId || !startDate || !endDate) {
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      void Swal.fire({
        icon: 'warning',
        title: this.t('تأكد من التواريخ', 'Check your dates'),
        text: this.t(
          'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
          'End date must be after start date.',
        ),
      });
      return;
    }

    this.isSubmitting.set(true);

    this.hostBookingService
      .blockDates({
        propertyId,
        startDate,
        endDate,
        reason: reason?.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void Swal.fire({
            toast: true,
            position: 'top-end',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            icon: 'success',
            title: this.t('تم حظر التواريخ بنجاح', 'Dates blocked successfully'),
          });

          this.form.reset({
            propertyId: null,
            startDate: '',
            endDate: '',
            reason: '',
          });

          this.isSubmitting.set(false);
        },
        error: () => {
          this.isSubmitting.set(false);
          void Swal.fire({
            icon: 'error',
            title: this.t('تعذر حفظ الحظر', 'Could not save block dates'),
            text: this.t(
              'حدث خطأ غير متوقع. حاول مرة أخرى.',
              'An unexpected error occurred. Please try again.',
            ),
          });
        },
      });
  }

  protected propertyLabel(property: Property): string {
    return this.lang.currentLang() === 'ar' ? property.name.ar : property.name.en;
  }

  protected showPropertyRequiredError(): boolean {
    const control = this.form.controls.propertyId;
    return !!control.errors?.['required'] && (control.touched || control.dirty);
  }

  protected async onAddRule(): Promise<void> {
    this.priceRuleForm.markAllAsTouched();
    const propertyId = this.selectedPropertyId();

    if (!propertyId) {
      this.form.controls.propertyId.markAsTouched();
      return;
    }

    if (this.priceRuleForm.invalid || this.isRuleSaving()) {
      return;
    }

    const raw = this.priceRuleForm.getRawValue();
    const payload: CreatePriceRuleDto = {
      startDate: raw.startDate ?? '',
      endDate: raw.endDate ?? '',
      customPrice: Number(raw.customPrice ?? 0),
    };

    if (new Date(payload.endDate).getTime() <= new Date(payload.startDate).getTime()) {
      await Swal.fire({
        icon: 'warning',
        title: this.tr('BLOCK_DATES.VALIDATION_RULE_DATE_RANGE'),
      });
      return;
    }

    this.isRuleSaving.set(true);
    this.rulesError.set(null);

    this.propertyService
      .addPriceRule(propertyId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (savedRule) => {
          const rules = [...this.priceRules(), savedRule].sort(
            (left, right) => Date.parse(left.startDate) - Date.parse(right.startDate),
          );
          this.priceRules.set(rules);
          this.priceRuleForm.reset({ startDate: '', endDate: '', customPrice: null });
          this.isRuleSaving.set(false);
        },
        error: () => {
          this.rulesError.set(this.tr('BLOCK_DATES.PRICE_RULES_SAVE_ERROR'));
          this.isRuleSaving.set(false);
        },
      });
  }

  protected removeRule(ruleId: string): void {
    const propertyId = this.selectedPropertyId();
    if (!propertyId) {
      return;
    }

    this.markRulePending(ruleId, true);
    this.rulesError.set(null);

    this.propertyService
      .removePriceRule(propertyId, ruleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.priceRules.update((rules) => rules.filter((rule) => rule.id !== ruleId));
          this.markRulePending(ruleId, false);
        },
        error: () => {
          this.rulesError.set(this.tr('BLOCK_DATES.PRICE_RULES_DELETE_ERROR'));
          this.markRulePending(ruleId, false);
        },
      });
  }

  protected isRulePending(ruleId: string): boolean {
    return this.pendingRuleIds().has(ruleId);
  }

  protected formatRuleRange(startDate: string, endDate: string): string {
    return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
  }

  protected formatCurrency(value: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected tr(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private toBlockProperty(property: HostPropertySummary): Property {
    return {
      id: property.id,
      name: {
        ar: property.title,
        en: property.title,
      },
      address: {
        ar: property.city,
        en: property.city,
        mapUrl: '',
      },
      price: {
        amount: property.pricePerNight,
        currency: property.currency,
      },
      imageUrl: property.thumbnailUrl ?? '',
    };
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private loadPriceRules(propertyId: string): void {
    this.isRulesLoading.set(true);
    this.rulesError.set(null);

    this.propertyService
      .getPriceRules(propertyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rules) => {
          this.priceRules.set(
            (rules ?? []).slice().sort(
              (left, right) => Date.parse(left.startDate) - Date.parse(right.startDate),
            ),
          );
          this.isRulesLoading.set(false);
        },
        error: () => {
          this.priceRules.set([]);
          this.rulesError.set(this.tr('BLOCK_DATES.PRICE_RULES_LOAD_ERROR'));
          this.isRulesLoading.set(false);
        },
      });
  }

  private formatDate(value: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  private markRulePending(ruleId: string, pending: boolean): void {
    this.pendingRuleIds.update((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(ruleId);
      } else {
        next.delete(ruleId);
      }
      return next;
    });
  }
}
