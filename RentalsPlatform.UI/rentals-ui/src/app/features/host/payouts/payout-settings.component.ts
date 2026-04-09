import {
  ChangeDetectionStrategy,
  Component,
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

import { LanguageService } from '../../../core/services/language.service';
import {
  PayoutMethod,
  PayoutService,
  SavePayoutDetailsDto,
} from '../services/payout.service';

const EGYPTIAN_BANKS = ['CIB', 'NBE', 'Banque Misr', 'AlexBank', 'QNB Al Ahli'];

@Component({
  selector: 'app-payout-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payout-settings.component.html',
  styleUrl: './payout-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PayoutSettingsComponent {
  protected readonly fb = inject(FormBuilder);
  protected readonly lang = inject(LanguageService);
  protected readonly payoutService = inject(PayoutService);

  protected readonly payoutMethod = signal<PayoutMethod>('bank');
  protected readonly egyptianBanks = EGYPTIAN_BANKS;

  protected readonly form = this.fb.group({
    beneficiaryName: this.fb.control('', [Validators.required, alphabeticValidator()]),
    bankName: this.fb.control('', [Validators.required]),
    iban: this.fb.control('', [Validators.required, egyptianIbanValidator()]),
    walletNumber: this.fb.control('', [walletNumberValidator()]),
  });

  protected readonly isSetupComplete = computed(
    () => this.payoutService.status().isSetupComplete,
  );

  protected readonly maskedAccount = computed(
    () => this.payoutService.status().maskedAccount ?? '****',
  );

  protected readonly subMerchantId = computed(
    () => this.payoutService.status().subMerchantId,
  );

  constructor() {
    this.applyMethodValidators(this.payoutMethod());
  }

  protected setPayoutMethod(method: PayoutMethod): void {
    if (this.payoutMethod() === method) {
      return;
    }

    this.payoutMethod.set(method);
    this.payoutService.resetError();
    this.applyMethodValidators(method);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.payoutService.resetError();

    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const payload: SavePayoutDetailsDto = {
      payoutMethod: this.payoutMethod(),
      beneficiaryName: this.payoutMethod() === 'bank' ? raw.beneficiaryName?.trim() ?? '' : undefined,
      bankName: this.payoutMethod() === 'bank' ? raw.bankName ?? '' : undefined,
      iban: this.payoutMethod() === 'bank' ? normalizeIban(raw.iban ?? '') : undefined,
      walletNumber:
        this.payoutMethod() === 'wallet'
          ? normalizeDigits(raw.walletNumber ?? '')
          : undefined,
    };

    try {
      this.form.disable({ emitEvent: false });
      await this.payoutService.saveBankDetails(payload);
    } catch {
      // Error state is already managed by the service.
    } finally {
      if (!this.isSetupComplete()) {
        this.form.enable({ emitEvent: false });
        this.applyMethodValidators(this.payoutMethod());
      }
    }
  }

  protected shouldShowError(controlName: 'beneficiaryName' | 'bankName' | 'iban' | 'walletNumber'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected errorText(controlName: 'beneficiaryName' | 'bankName' | 'iban' | 'walletNumber'): string {
    const control = this.form.controls[controlName];
    if (!control?.errors) {
      return '';
    }

    if (control.errors['required']) {
      return this.t('هذا الحقل مطلوب', 'This field is required');
    }

    if (control.errors['alphabeticOnly']) {
      return this.t('يجب أن يحتوي الاسم على أحرف فقط', 'Name must contain letters only');
    }

    if (control.errors['egyptianIban']) {
      return this.t('يجب أن يبدأ رقم الـ IBAN بـ EG ثم 27 رقماً', 'IBAN must start with EG followed by exactly 27 digits');
    }

    if (control.errors['walletNumber']) {
      return this.t('رقم المحفظة يجب أن يكون 11 رقماً ويبدأ بـ 01', 'Wallet number must be 11 digits and start with 01');
    }

    return this.t('قيمة غير صالحة', 'Invalid value');
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private applyMethodValidators(method: PayoutMethod): void {
    const beneficiaryName = this.form.controls.beneficiaryName;
    const bankName = this.form.controls.bankName;
    const iban = this.form.controls.iban;
    const walletNumber = this.form.controls.walletNumber;

    if (method === 'bank') {
      beneficiaryName.setValidators([Validators.required, alphabeticValidator()]);
      bankName.setValidators([Validators.required]);
      iban.setValidators([Validators.required, egyptianIbanValidator()]);
      walletNumber.setValidators([walletNumberValidator()]);
      walletNumber.reset(walletNumber.value ?? '', { emitEvent: false });
    } else {
      beneficiaryName.clearValidators();
      bankName.clearValidators();
      iban.clearValidators();
      walletNumber.setValidators([Validators.required, walletNumberValidator()]);

      beneficiaryName.reset(beneficiaryName.value ?? '', { emitEvent: false });
      bankName.reset(bankName.value ?? '', { emitEvent: false });
      iban.reset(iban.value ?? '', { emitEvent: false });
    }

    beneficiaryName.updateValueAndValidity({ emitEvent: false });
    bankName.updateValueAndValidity({ emitEvent: false });
    iban.updateValueAndValidity({ emitEvent: false });
    walletNumber.updateValueAndValidity({ emitEvent: false });
  }
}

function alphabeticValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }

    return /^[A-Za-z\u0600-\u06FF\s]+$/.test(value)
      ? null
      : { alphabeticOnly: true };
  };
}

function egyptianIbanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeIban(String(control.value ?? ''));
    if (!value) {
      return null;
    }

    return /^EG\d{27}$/.test(value) ? null : { egyptianIban: true };
  };
}

function walletNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeDigits(String(control.value ?? ''));
    if (!value) {
      return null;
    }

    return /^01\d{9}$/.test(value) ? null : { walletNumber: true };
  };
}

function normalizeIban(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

function normalizeDigits(value: string): string {
  return value.replace(/\D+/g, '');
}
