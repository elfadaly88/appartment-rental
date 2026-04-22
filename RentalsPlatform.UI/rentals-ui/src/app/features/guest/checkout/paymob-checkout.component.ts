import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { PLATFORM_ID } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { CheckoutStore } from '../state/checkout.store';
import { LanguageService } from '../../../core/services/language.service';
import {
  egyptianPhoneValidator,
  isValidEgyptianPhone,
  normalizeEgyptianPhone,
} from '../../../core/validators/egyptian-phone.validator';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-paymob-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './paymob-checkout.component.html',
  styleUrl: './paymob-checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class PaymobCheckoutComponent implements OnInit {
  protected readonly store = inject(CheckoutStore);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly lang = inject(LanguageService);
  protected readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly isPhoneModalOpen = signal(false);
  protected readonly isSavingPhone = signal(false);

  protected readonly phoneForm = this.fb.nonNullable.group({
    countryCode: ['+20'],
    phoneNumber: ['', [egyptianPhoneValidator()]],
  });

  private readonly bookingIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('bookingId') ?? '')),
    { initialValue: '' },
  );

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.prefillPhone();
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.store.clear();
    });
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected retryRedirect(): void {
    void this.payNow();
  }

  protected openSecurePaymentPage(): void {
    const checkoutUrl = this.store.paymentSession()?.checkoutUrl;
    if (!checkoutUrl || !isPlatformBrowser(this.platformId)) {
      return;
    }

    window.location.assign(checkoutUrl);
  }

  protected async payNow(): Promise<void> {
    const bookingId = this.bookingIdParam();
    if (!bookingId) {
      return;
    }

    const rawPhone = this.phoneForm.controls.phoneNumber.value;
    if (!isValidEgyptianPhone(rawPhone)) {
      this.isPhoneModalOpen.set(true);
      this.phoneForm.controls.phoneNumber.markAsTouched();
      return;
    }

    await this.savePhoneToProfile();
    if (this.phoneForm.invalid) {
      return;
    }

    try {
      await this.beginCheckout(bookingId);
    } catch (error) {
      console.error('[PaymobCheckoutComponent] checkout failed', error);
      await this.router.navigate(['/checkout/callback'], {
        queryParams: { success: 'false', bookingId },
      });
    }
  }

  protected onPhoneInput(): void {
    const normalized = normalizeEgyptianPhone(this.phoneForm.controls.phoneNumber.value);
    this.phoneForm.controls.phoneNumber.setValue(normalized, { emitEvent: false });
  }

  protected openPhoneModal(): void {
    this.isPhoneModalOpen.set(true);
  }

  protected closePhoneModal(): void {
    this.isPhoneModalOpen.set(false);
  }

  protected async savePhoneFromModal(): Promise<void> {
    await this.savePhoneToProfile();
    if (this.phoneForm.valid) {
      this.isPhoneModalOpen.set(false);
    }
  }

  private async beginCheckout(bookingId: string): Promise<void> {
    await this.store.initiatePayment(bookingId);
    const session = this.store.paymentSession();
    if (!session) {
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.setItem('pendingPaymobBookingId', bookingId);

    if (!session.checkoutUrl) {
      throw new Error('Paymob checkout URL was not returned by API.');
    }

    window.location.assign(session.checkoutUrl);
  }

  private async prefillPhone(): Promise<void> {
    try {
      const profile = await firstValueFrom(
        this.http.get<{ phoneNumber?: string }>(`${environment.apiUrl}/profile/me`),
      );

      const normalizedPhone = normalizeEgyptianPhone(profile.phoneNumber);
      this.phoneForm.patchValue({ phoneNumber: normalizedPhone });
      if (!normalizedPhone) {
        this.isPhoneModalOpen.set(true);
      }
    } catch {
      this.isPhoneModalOpen.set(true);
    }
  }

  private async savePhoneToProfile(): Promise<void> {
    this.onPhoneInput();
    if (this.phoneForm.invalid) {
      this.phoneForm.controls.phoneNumber.markAsTouched();
      return;
    }

    const rawPhone = this.phoneForm.controls.phoneNumber.value;
    const selectedCode = this.phoneForm.controls.countryCode.value;
    const combined = rawPhone.startsWith('0') ? rawPhone : `${selectedCode}${rawPhone}`;
    const normalizedPhone = normalizeEgyptianPhone(combined);
    if (!normalizedPhone) {
      this.phoneForm.controls.phoneNumber.setErrors({ required: true });
      return;
    }

    this.isSavingPhone.set(true);
    try {
      const formData = new FormData();
      formData.append('phoneNumber', normalizedPhone);
      await firstValueFrom(this.http.put(`${environment.apiUrl}/profile`, formData));
      this.phoneForm.patchValue({ phoneNumber: normalizedPhone });
    } catch {
      this.phoneForm.controls.phoneNumber.setErrors({ saveFailed: true });
    } finally {
      this.isSavingPhone.set(false);
    }
  }
}