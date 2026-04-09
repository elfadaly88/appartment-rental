import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

import {
  BookingService,
  CreateBookingDto,
} from '../../core/services/booking.service';
import {
  NotificationService,
  NotificationMessage,
} from '../../core/services/notification.service';
import { PropertyStore } from '../../core/state/property.store';
import { LanguageService } from '../../core/services/language.service';
import { AuthStore } from '../../core/state/auth.store';
import { Router } from '@angular/router';

@Component({
  selector: 'app-property-detail-component',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './property-detail.component.html',
  styleUrl: './property-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
  },
})
export class PropertyDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  protected readonly notificationService = inject(NotificationService);
  protected readonly store = inject(PropertyStore);
  protected readonly lang = inject(LanguageService);
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly property = computed(
    () => this.store.properties().find((p) => p.id === this.id()) ?? null,
  );

  protected readonly latestNotification = this.notificationService.latestNotification;
  protected readonly notifications = this.notificationService.notifications;

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

  protected readonly bookingForm = this.fb.nonNullable.group({
    checkInDate: ['', Validators.required],
    checkOutDate: ['', Validators.required],
  });

  private lastShownNotificationId: string | null = null;

  constructor() {
    effect(() => {
      const notif = this.latestNotification();
      if (!notif || notif.id === this.lastShownNotificationId) {
        return;
      }

      this.lastShownNotificationId = notif.id;
      this.showNotificationToast(notif);
    });
  }

  ngOnInit(): void {
    this.store.loadProperties();
    this.notificationService.startConnection();
  }

  protected onBookNow(): void {
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
      }).then((result) => {
        if (result.isConfirmed) {
          void this.router.navigate(['/auth']);
        }
      });
      return;
    }

    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      void Swal.fire({
        icon: 'warning',
        title: this.t('تحقق من البيانات', 'Check your data'),
        text: this.t(
          'من فضلك اختر تاريخ الوصول والمغادرة.',
          'Please select check-in and check-out dates.',
        ),
      });
      return;
    }

    const payload: CreateBookingDto = {
      propertyId: this.id(),
      guestId: this.authStore.currentUser()?.id || 'USER_GUID_HERE',
      checkInDate: this.bookingForm.controls.checkInDate.value,
      checkOutDate: this.bookingForm.controls.checkOutDate.value,
    };

    this.bookingService.createBooking(payload).subscribe({
      next: (res) => {
        console.log('Booking saved in DB:', res.id);
        void Swal.fire({
          icon: 'success',
          title: this.t('تم الحجز بنجاح', 'Booking Confirmed'),
          text: this.t(
            'تم حفظ الحجز بنجاح. سيتم إرسال إشعار التأكيد قريباً.',
            'Your booking was saved successfully. Confirmation notification will arrive shortly.',
          ),
          confirmButtonText: this.t('ممتاز', 'Great'),
        });
      },
      error: () => {
        void Swal.fire({
          icon: 'error',
          title: this.t('غير متاح', 'Not Available'),
          text: this.t(
            'هذا العقار محجوز بالفعل في هذه التواريخ.',
            'This property is already booked for these dates!',
          ),
          confirmButtonText: this.t('حسناً', 'OK'),
        });
      },
    });
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private showNotificationToast(message: NotificationMessage): void {
    void Swal.fire({
      toast: true,
      position: 'top-end',
      timer: 5000,
      timerProgressBar: true,
      showConfirmButton: false,
      icon: 'info',
      title: message.title || this.t('إشعار جديد', 'New notification'),
      text: message.body,
    });
  }
}
