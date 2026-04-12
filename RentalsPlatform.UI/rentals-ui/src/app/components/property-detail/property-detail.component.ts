import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { SlicePipe } from '@angular/common';
import Swal from 'sweetalert2';

import { BookingService, CreateBookingDto } from '../../core/services/booking.service';
import { NotificationService, NotificationMessage } from '../../core/services/notification.service';
import { PropertyStore } from '../../core/state/property.store';
import { LanguageService } from '../../core/services/language.service';
import { AuthStore } from '../../core/state/auth.store';
import { environment } from '../../../environments/environment';

interface AvailabilityRange {
  startDate: string;
  endDate: string;
  reason?: string | null;
  source: 'HostBlocked' | 'Booked';
}

interface PropertyAvailabilityResponse {
  blockedDates: AvailabilityRange[];
  bookedDates: AvailabilityRange[];
}

@Component({
  selector: 'app-property-detail-component',
  imports: [ReactiveFormsModule, RouterLink, SlicePipe],
  templateUrl: './property-detail.component.html',
  styleUrl: './property-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('bookBtnPulse', [
      state('idle', style({ transform: 'scale(1)' })),
      state('active', style({ transform: 'scale(0.97)' })),
      transition('idle <=> active', animate('120ms ease-in-out')),
    ]),
  ],
  host: { '[attr.dir]': 'lang.dir()' },
})
export class PropertyDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly http = inject(HttpClient);
  protected readonly notificationService = inject(NotificationService);
  protected readonly store = inject(PropertyStore);
  protected readonly lang = inject(LanguageService);
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  // ── Property & Host ──────────────────────────────────────────────
  protected readonly property = computed(
    () => this.store.properties().find((p) => p.id === this.id()) ?? null,
  );

  protected readonly propertyDetails = signal<any>(null);
  protected readonly hostProfile = signal<any>(null);
  protected readonly isLoadingDetails = signal(true);
  protected readonly isLoadingAvailability = signal(true);
  protected readonly isBooking = signal(false);
  protected readonly bookBtnState = signal<'idle' | 'active'>('idle');
  protected readonly selectedImageUrl = signal<string>('');
  protected readonly blockedRanges = signal<AvailabilityRange[]>([]);
  protected readonly bookedRanges = signal<AvailabilityRange[]>([]);

  protected readonly latestNotification = this.notificationService.latestNotification;
  private lastShownNotificationId: string | null = null;

  // ── Dates ─────────────────────────────────────────────────────────
  protected readonly todayDate = new Date().toISOString().split('T')[0];

  protected readonly bookingForm = this.fb.nonNullable.group({
    checkInDate: ['', [Validators.required]],
    checkOutDate: ['', [Validators.required]],
    guestCount: [1, [Validators.required, Validators.min(1)]],
  });

  private readonly checkInValue = toSignal(
    this.bookingForm.controls.checkInDate.valueChanges,
    { initialValue: '' },
  );
  private readonly checkOutValue = toSignal(
    this.bookingForm.controls.checkOutDate.valueChanges,
    { initialValue: '' },
  );
  private readonly guestCountValue = toSignal(
    this.bookingForm.controls.guestCount.valueChanges,
    { initialValue: 1 },
  );

  protected readonly selectedGuests = computed(() => Number(this.guestCountValue() ?? 1));

  protected readonly maxGuests = computed(() => {
    const detailsMax = Number(this.propertyDetails()?.maxGuests ?? 0);
    if (detailsMax > 0) return detailsMax;

    const listMax = Number(this.property()?.maxGuests ?? 0);
    return listMax > 0 ? listMax : 1;
  });

  protected readonly guestCapacityError = computed(() => {
    const selected = this.selectedGuests();
    const max = this.maxGuests();
    if (selected <= max) return '';

    return this.t(
      `عفواً، السعة القصوى لهذا المكان هي (${max}) أفراد فقط`,
      `Sorry, the maximum capacity for this place is (${max}) guests only.`,
    );
  });

  protected readonly hasDateConflict = computed(() => {
    const checkInDate = this.bookingForm.controls.checkInDate.value;
    const checkOutDate = this.bookingForm.controls.checkOutDate.value;
    if (!checkInDate || !checkOutDate) return false;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return false;
    if (checkOut <= checkIn) return false;

    const ranges = [...this.blockedRanges(), ...this.bookedRanges()];
    return ranges.some((range) => this.isOverlappingRange(checkIn, checkOut, range.startDate, range.endDate));
  });

  protected readonly conflictWarning = computed(() => {
    if (!this.hasDateConflict()) return '';
    return this.t(
      'تحذير تعارض: التواريخ المختارة تتداخل مع حجز مؤكد أو تواريخ محجوبة.',
      'Conflict warning: the selected dates overlap with existing reserved or blocked dates.',
    );
  });

  protected readonly canSubmitBooking = computed(() => {
    console.log('Re-evaluating canSubmitBooking: isBooking=', this.isBooking(), 'formValid=', this.bookingForm.valid, 'nights=', this.nights(), 'guestError=', this.guestCapacityError(), 'dateConflict=', this.hasDateConflict());
    if (this.isBooking() || this.bookingForm.invalid || this.nights() < 1) return false;
    if (!!this.guestCapacityError()) return false;
    if (this.hasDateConflict()) return false;
    return true;
  });

  protected readonly unavailableRanges = computed(() => [
    ...this.blockedRanges().map((x) => ({
      startDate: x.startDate,
      endDate: x.endDate,
      label: this.t('محجوب بواسطة المضيف', 'Blocked by host'),
    })),
    ...this.bookedRanges().map((x) => ({
      startDate: x.startDate,
      endDate: x.endDate,
      label: this.t('محجوز بالفعل', 'Already booked'),
    })),
  ]);

  protected readonly minCheckOutDate = computed(() => {
    const ci = this.checkInValue();
    if (!ci) return this.todayDate;
    const d = new Date(ci);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  // ── Price Calculation (fully reactive) ────────────────────────────
  protected readonly nights = computed(() => {
    const ci = this.checkInValue();
    const co = this.checkOutValue();
    if (!ci || !co) return 0;
    const diff = new Date(co).getTime() - new Date(ci).getTime();
    const n = Math.round(diff / 86400000);
    return n > 0 ? n : 0;
  });

  protected readonly nightlyRate = computed(() =>
    this.property()?.price?.amount ?? 0,
  );

  protected readonly subtotal = computed(() => this.nights() * this.nightlyRate());
  protected readonly serviceFeeRate = computed(() => {
    const value = Number(this.propertyDetails()?.serviceFeePercentage ?? this.property()?.serviceFeePercentage ?? 0);
    return value > 0 ? value / 100 : 0;
  });

  protected readonly taxRate = computed(() => {
    const value = Number(this.propertyDetails()?.taxPercentage ?? this.property()?.taxPercentage ?? 0);
    return value > 0 ? value / 100 : 0;
  });

  protected readonly serviceFee = computed(() => {
    const rate = this.serviceFeeRate();
    if (rate <= 0) return 0;
    return this.roundAmount(this.subtotal() * rate);
  });

  protected readonly taxes = computed(() => {
    const rate = this.taxRate();
    if (rate <= 0) return 0;
    return this.roundAmount((this.subtotal() + this.serviceFee()) * rate);
  });
  protected readonly grandTotal = computed(() =>
    this.subtotal() + this.serviceFee() + this.taxes(),
  );

  protected readonly currency = computed(
    () => this.property()?.price?.currency ?? 'EGP',
  );

  protected readonly formattedNightlyRate = computed(() => {
    const prop = this.property();
    if (!prop) return '';
    return this.formatCurrency(prop.price.amount, prop.price.currency);
  });

  // ── Lifecycle ─────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const notif = this.latestNotification();
      if (!notif || notif.id === this.lastShownNotificationId) return;
      this.lastShownNotificationId = notif.id;
      this.showNotificationToast(notif);
    });
  }

  ngOnInit(): void {
    this.store.loadProperties();
    this.notificationService.startConnection();
    this.loadPropertyDetails();
    this.loadAvailability();
  }

  private loadPropertyDetails(): void {
    this.http
      .get<any>(`${environment.apiUrl}/properties/${this.id()}`)
      .subscribe({
        next: (data) => {
          this.propertyDetails.set(data);
          this.selectedImageUrl.set(Array.isArray(data?.images) ? (data.images[0] ?? '') : '');
          this.isLoadingDetails.set(false);
        },
        error: () => this.isLoadingDetails.set(false),
      });
  }

  private loadAvailability(): void {
    this.isLoadingAvailability.set(true);
    this.http
      .get<PropertyAvailabilityResponse>(`${environment.apiUrl}/bookings/availability`, {
        params: { propertyId: this.id() },
      })
      .subscribe({
        next: (data) => {
          this.blockedRanges.set(data?.blockedDates ?? []);
          this.bookedRanges.set(data?.bookedDates ?? []);
          this.isLoadingAvailability.set(false);
        },
        error: () => {
          this.blockedRanges.set([]);
          this.bookedRanges.set([]);
          this.isLoadingAvailability.set(false);
        },
      });
  }

  private roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  // ── Booking Logic ─────────────────────────────────────────────────
  protected onBookNow(): void {
    this.bookBtnState.set('active');
    setTimeout(() => this.bookBtnState.set('idle'), 200);

    if (!this.authStore.isAuthenticated()) {
      void Swal.fire({
        icon: 'info',
        title: this.t('يرجى تسجيل الدخول', 'Please log in'),
        text: this.t(
          'يجب عليك تسجيل الدخول للمتابعة في عملية الحجز.',
          'You must be logged in to proceed with the booking.',
        ),
        confirmButtonText: this.t('تسجيل الدخول', 'Log In'),
        showCancelButton: true,
        cancelButtonText: this.t('إلغاء', 'Cancel'),
      }).then((r) => { if (r.isConfirmed) void this.router.navigate(['/auth']); });
      return;
    }

    if (this.bookingForm.invalid || this.nights() < 1) {
      this.bookingForm.markAllAsTouched();
      void Swal.fire({
        icon: 'warning',
        title: this.t('تحقق من التواريخ', 'Check your dates'),
        text: this.t(
          'يرجى اختيار تواريخ صحيحة. الحد الأدنى للإقامة ليلة واحدة.',
          'Please select valid dates. Minimum stay is 1 night.',
        ),
      });
      return;
    }

    if (this.guestCapacityError()) {
      void Swal.fire({
        icon: 'error',
        title: this.t('عدد الضيوف غير مسموح', 'Invalid guest count'),
        text: this.guestCapacityError(),
      });
      return;
    }

    if (this.hasDateConflict()) {
      void Swal.fire({
        icon: 'warning',
        title: this.t('تعارض في التواريخ', 'Date conflict'),
        text: this.conflictWarning(),
      });
      return;
    }

    this.isBooking.set(true);

    const payload: CreateBookingDto = {
      propertyId: this.id(),
      guestId: this.authStore.currentUser()?.id ?? '',
      guestCount: this.selectedGuests(),
      checkInDate: this.bookingForm.controls.checkInDate.value,
      checkOutDate: this.bookingForm.controls.checkOutDate.value,
    };

    this.bookingService.createBooking(payload).subscribe({
      next: (res) => {
        this.isBooking.set(false);
        void Swal.fire({
          icon: 'success',
          title: this.t('تم الحجز بنجاح! 🎉', 'Booking Confirmed! 🎉'),
          html: this.t(
            `<p>رقم الحجز: <strong>${res.id}</strong></p><p>سيتم إرسال تفاصيل تأكيد الحجز قريباً.</p>`,
            `<p>Booking ID: <strong>${res.id}</strong></p><p>Confirmation details will be sent shortly.</p>`,
          ),
          confirmButtonText: this.t('رائع', 'Great'),
          confirmButtonColor: '#0f766e',
        });
      },
      error: (err) => {
        this.isBooking.set(false);
        const msg = err?.error?.message ??
          this.t(
            'هذا العقار غير متاح في هذه التواريخ.',
            'This property is unavailable for these dates.',
          );
        void Swal.fire({
          icon: 'error',
          title: this.t('تعذر الحجز', 'Booking Failed'),
          text: msg,
          confirmButtonColor: '#dc2626',
        });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected formatCurrency(amount: number, currency: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }

  protected getPropertyName(): string {
    const d = this.propertyDetails();
    if (d) return this.lang.currentLang() === 'ar' ? d.name?.ar : d.name?.en;
    const p = this.property();
    return p ? (this.lang.currentLang() === 'ar' ? p.name.ar : p.name.en) : '';
  }

  protected getMainImage(): string {
    const selected = this.selectedImageUrl();
    if (selected) {
      return selected;
    }

    const d = this.propertyDetails();
    if (d?.images?.length) return d.images[0];
    return this.property()?.imageUrl ?? '';
  }

  protected getAllImages(): string[] {
    return this.propertyDetails()?.images ?? [];
  }

  protected selectImage(imageUrl: string): void {
    this.selectedImageUrl.set(imageUrl);
  }

  protected getAddress(): string {
    const d = this.propertyDetails();
    if (d) {
      const city = this.lang.currentLang() === 'ar' ? d.address?.ar : d.address?.en;
      return `${city ?? ''}, ${d.address?.country ?? ''}`;
    }
    const p = this.property();
    return p ? (this.lang.currentLang() === 'ar' ? p.address.ar : p.address.en) : '';
  }

  protected formatRangeDate(dateIso: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    const date = this.dateOnlyToLocalDate(dateIso);
    if (!date) {
      return dateIso;
    }

    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private isOverlappingRange(checkIn: Date, checkOut: Date, existingStart: string, existingEnd: string): boolean {
    const checkInDay = this.toDayNumber(checkIn);
    const checkOutDay = this.toDayNumber(checkOut);
    const existingCheckInDay = this.toDayNumber(existingStart);
    const existingCheckOutDay = this.toDayNumber(existingEnd);

    if (checkInDay === null || checkOutDay === null || existingCheckInDay === null || existingCheckOutDay === null) {
      return false;
    }

    // Required overlap predicate: !(CheckIn >= ExistingCheckOut || CheckOut <= ExistingCheckIn)
    return !(checkInDay >= existingCheckOutDay || checkOutDay <= existingCheckInDay);
  }

  private toDayNumber(value: Date | string): number | null {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }

      return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
    }

    const [yearText, monthText, dayText] = value.split('T')[0].split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return Date.UTC(year, month - 1, day) / 86400000;
  }

  private dateOnlyToLocalDate(value: string): Date | null {
    const [yearText, monthText, dayText] = value.split('T')[0].split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private showNotificationToast(message: NotificationMessage): void {
    void Swal.fire({
      toast: true, position: 'top-end', timer: 5000,
      timerProgressBar: true, showConfirmButton: false,
      icon: 'info',
      title: message.title || this.t('إشعار جديد', 'New notification'),
      text: message.body,
    });
  }
}
