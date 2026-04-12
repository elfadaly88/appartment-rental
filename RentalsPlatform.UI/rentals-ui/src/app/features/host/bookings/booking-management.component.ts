import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

import { LanguageService } from '../../../core/services/language.service';
import {
  BookingStore,
  HostBooking,
  BookingStatus,
} from '../state/booking.store';

type BookingTab = 'pending' | 'upcoming' | 'history';

@Component({
  selector: 'app-booking-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-management.component.html',
  styleUrl: './booking-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class BookingManagementComponent implements OnInit {
  protected readonly lang = inject(LanguageService);
  protected readonly bookingStore = inject(BookingStore);

  protected readonly activeTab = signal<BookingTab>('pending');

  protected readonly tabItems = computed(() => [
    {
      key: 'pending' as const,
      label: this.t('قيد المراجعة', 'Pending'),
      count: this.bookingStore.pendingRequests().length,
    },
    {
      key: 'upcoming' as const,
      label: this.t('الحجوزات القادمة', 'Upcoming'),
      count: this.bookingStore.upcomingBookings().length,
    },
    {
      key: 'history' as const,
      label: this.t('السجل', 'History'),
      count: this.bookingStore.pastBookings().length,
    },
  ]);

  protected readonly visibleBookings = computed(() => {
    const tab = this.activeTab();
    if (tab === 'pending') {
      return this.bookingStore.pendingRequests();
    }
    if (tab === 'upcoming') {
      return this.bookingStore.upcomingBookings();
    }
    return this.bookingStore.pastBookings();
  });

  ngOnInit(): void {
    void this.bookingStore.loadBookings();
  }

  protected setTab(tab: BookingTab): void {
    this.activeTab.set(tab);
  }

  protected async approve(id: string): Promise<void> {
    await this.bookingStore.approveBooking(id);

    if (!this.bookingStore.error()) {
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        showConfirmButton: false,
        timer: 2400,
        title: this.t('تمت الموافقة على الحجز', 'Booking approved'),
      });
      return;
    }

    this.showErrorToast();
  }

  protected async reject(id: string): Promise<void> {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: this.t('سبب رفض الحجز', 'Reason for rejection'),
      input: 'textarea',
      inputPlaceholder: this.t('اكتب سبب الرفض هنا...', 'Write the rejection reason here...'),
      showCancelButton: true,
      confirmButtonText: this.t('تأكيد الرفض', 'Confirm rejection'),
      cancelButtonText: this.t('إلغاء', 'Cancel'),
      inputValidator: (value) => {
        if (!value?.trim()) {
          return this.t('سبب الرفض مطلوب', 'Rejection reason is required.');
        }
        return null;
      },
    });

    if (!isConfirmed || !reason?.trim()) {
      return;
    }

    await this.bookingStore.rejectBooking(id, reason.trim());

    if (!this.bookingStore.error()) {
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        showConfirmButton: false,
        timer: 2400,
        title: this.t('تم رفض الحجز', 'Booking declined'),
      });
      return;
    }

    this.showErrorToast();
  }

  protected isActionBusy(id: string): boolean {
    return this.bookingStore.isActionInProgress(id);
  }

  protected statusLabel(status: BookingStatus): string {
    if (status === 'pending') return this.t('قيد المراجعة', 'Pending');
    if (status === 'approved') return this.t('تمت الموافقة', 'Approved');
    if (status === 'active') return this.t('نشط', 'Active');
    if (status === 'completed') return this.t('مكتمل', 'Completed');
    if (status === 'rejected') return this.t('مرفوض', 'Declined');
    return this.t('ملغي', 'Cancelled');
  }

  protected formatDateRange(booking: HostBooking): string {
    return `${this.formatDate(booking.checkInDate)} - ${this.formatDate(booking.checkOutDate)}`;
  }

  protected formatDate(value: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected formatPrice(value: number, currency: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected emptyTitle(): string {
    const tab = this.activeTab();
    if (tab === 'pending') {
      return this.t('لا توجد طلبات حالياً', 'No pending requests');
    }
    if (tab === 'upcoming') {
      return this.t('لا توجد حجوزات قادمة', 'No upcoming bookings');
    }
    return this.t('لا يوجد سجل حجوزات بعد', 'No booking history yet');
  }

  protected emptyHint(): string {
    const tab = this.activeTab();
    if (tab === 'pending') {
      return this.t('ستظهر طلبات الحجز الجديدة هنا تلقائياً.', 'New booking requests will appear here automatically.');
    }
    if (tab === 'upcoming') {
      return this.t('بعد الموافقة على الطلبات ستظهر في هذه القائمة.', 'Approved requests will show up in this list.');
    }
    return this.t('سجل الحجوزات المكتملة أو الملغاة سيظهر هنا.', 'Completed and declined bookings will appear here.');
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private showErrorToast(): void {
    void Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      showConfirmButton: false,
      timer: 2800,
      title: this.t('تعذر تحديث الحجز', 'Could not update booking'),
    });
  }
}
