import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { LanguageService } from '../../../core/services/language.service';
import { environment } from '../../../../environments/environment';

interface PriceRuleDto {
  id: string;
  startDate: string;
  endDate: string;
  customPrice: number;
}

interface CreatePriceRuleDto {
  startDate: string;
  endDate: string;
  customPrice: number;
}

@Injectable()
class PriceRulesStore {
  private readonly http = inject(HttpClient);

  readonly rules = signal<PriceRuleDto[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingIds = signal<Set<string>>(new Set<string>());

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<PriceRuleDto[]>(`${environment.apiUrl}/host/pricing-rules`),
      );

      this.rules.set(
        (response ?? []).slice().sort((left, right) =>
          Date.parse(left.startDate) - Date.parse(right.startDate),
        ),
      );
    } catch (error) {
      console.error('[PriceRulesStore] load failed', error);
      this.error.set('Unable to load seasonal pricing rules.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addRule(payload: CreatePriceRuleDto): Promise<boolean> {
    const optimisticId = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticRule: PriceRuleDto = {
      id: optimisticId,
      ...payload,
    };

    this.error.set(null);
    this.rules.update((current) => this.sortRules([...current, optimisticRule]));
    this.markPending(optimisticId, true);

    try {
      const saved = await firstValueFrom(
        this.http.post<PriceRuleDto>(`${environment.apiUrl}/host/pricing-rules`, payload),
      );

      this.rules.update((current) =>
        this.sortRules(
          current.map((rule) => (rule.id === optimisticId ? saved ?? optimisticRule : rule)),
        ),
      );
      return true;
    } catch (error) {
      console.error('[PriceRulesStore] addRule failed', error);
      this.rules.update((current) => current.filter((rule) => rule.id !== optimisticId));
      this.error.set('Unable to save the pricing rule.');
      return false;
    } finally {
      this.markPending(optimisticId, false);
    }
  }

  async removeRule(ruleId: string): Promise<void> {
    const existing = this.rules().find((rule) => rule.id === ruleId);
    if (!existing) {
      return;
    }

    this.error.set(null);
    this.markPending(ruleId, true);
    this.rules.update((current) => current.filter((rule) => rule.id !== ruleId));

    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/host/pricing-rules/${encodeURIComponent(ruleId)}`),
      );
    } catch (error) {
      console.error('[PriceRulesStore] removeRule failed', error);
      this.rules.update((current) => this.sortRules([...current, existing]));
      this.error.set('Unable to delete the pricing rule.');
    } finally {
      this.markPending(ruleId, false);
    }
  }

  isPending(ruleId: string): boolean {
    return this.pendingIds().has(ruleId);
  }

  private sortRules(rules: PriceRuleDto[]): PriceRuleDto[] {
    return rules.slice().sort((left, right) => Date.parse(left.startDate) - Date.parse(right.startDate));
  }

  private markPending(ruleId: string, pending: boolean): void {
    this.pendingIds.update((current) => {
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

@Component({
  selector: 'app-price-rules',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './price-rules.component.html',
  styleUrl: './price-rules.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PriceRulesStore],
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PriceRulesComponent {
  protected readonly fb = inject(FormBuilder);
  protected readonly lang = inject(LanguageService);
  protected readonly store = inject(PriceRulesStore);

  protected readonly today = new Date().toISOString().split('T')[0];

  protected readonly form = this.fb.group(
    {
      startDate: this.fb.control('', [Validators.required]),
      endDate: this.fb.control('', [Validators.required]),
      customPrice: this.fb.control(0, [Validators.required, Validators.min(1)]),
    },
    { validators: dateRangeValidator() },
  );

  protected readonly rules = this.store.rules;
  protected readonly isLoading = this.store.isLoading;
  protected readonly error = this.store.error;
  protected readonly hasRules = computed(() => this.rules().length > 0);

  constructor() {
    void this.store.load();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const saved = await this.store.addRule({
      startDate: raw.startDate ?? '',
      endDate: raw.endDate ?? '',
      customPrice: Number(raw.customPrice ?? 0),
    });

    if (saved) {
      this.form.reset({
        startDate: '',
        endDate: '',
        customPrice: 0,
      });
    }
  }

  protected async remove(ruleId: string): Promise<void> {
    await this.store.removeRule(ruleId);
  }

  protected formatDateRange(startDate: string, endDate: string): string {
    return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
  }

  protected formatDate(value: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected formatCurrency(value: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected showFieldError(name: 'startDate' | 'endDate' | 'customPrice'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected showDateRangeError(): boolean {
    return !!this.form.errors?.['invalidDateRange'] && (this.form.touched || this.form.dirty);
  }

  protected isPending(ruleId: string): boolean {
    return this.store.isPending(ruleId);
  }

  protected trackRule(_index: number, rule: PriceRuleDto): string {
    return rule.id;
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}

function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (!startDate || !endDate) {
      return null;
    }

    return new Date(endDate).getTime() > new Date(startDate).getTime()
      ? null
      : { invalidDateRange: true };
  };
}