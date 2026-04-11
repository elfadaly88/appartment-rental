import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { GuestBookingService, GuestBooking } from './guest-booking.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './my-bookings.component.html',
  styleUrl: './my-bookings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookingsComponent implements OnInit {
  private readonly guestBookingService = inject(GuestBookingService);
  protected readonly lang = inject(LanguageService);

  // ── State signals ────────────────────────────────────────────────
  protected readonly bookings = signal<GuestBooking[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTab = signal<'upcoming' | 'history'>('upcoming');
  protected readonly cancellingId = signal<string | null>(null);

  // ── Today (string) for date comparisons ──────────────────────────
  protected readonly today = new Date().toISOString().split('T')[0];

  // ── Filtered lists ───────────────────────────────────────────────
  protected readonly upcomingBookings = computed(() =>
    this.bookings().filter(
      (b) =>
        (b.status === 1 || b.status === 6 || b.status === 2) &&
        b.checkOutDate >= this.today,
    ),
  );

  protected readonly historyBookings = computed(() =>
    this.bookings().filter(
      (b) =>
        b.status === 3 || b.status === 4 || b.status === 7 ||
        (b.status !== 1 && b.status !== 6 && b.checkOutDate < this.today),
    ),
  );

  protected readonly activeList = computed(() =>
    this.activeTab() === 'upcoming'
      ? this.upcomingBookings()
      : this.historyBookings(),
  );

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.guestBookingService.getMyBookings().subscribe({
      next: (data) => {
        this.bookings.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(this.t('تعذر تحميل حجوزاتك', 'Failed to load bookings'));
        this.isLoading.set(false);
      },
    });
  }

  // ── Status helpers ────────────────────────────────────────────────

  /** Returns the 4-step tracker index (0..3) for a booking. */
  protected trackerStep(b: GuestBooking): number {
    if (b.status === 2 && b.paymentStatus === 2) return 3; // Stay (confirmed+paid)
    if (b.status === 2) return 2;                          // Confirmed stage
    if (b.status === 6) return 2;                          // Approved = step 2
    if (b.status === 1) return 1;                          // Pending = step 1
    return 0;
  }

  protected statusLabel(b: GuestBooking): string {
    switch (b.status) {
      case 1: return this.t('بانتظار الموافقة', 'Pending Approval');
      case 6: return this.t('بانتظار الدفع', 'Awaiting Payment');
      case 2: return b.paymentStatus === 2
        ? this.t('مؤكد', 'Confirmed')
        : this.t('بانتظار الدفع', 'Awaiting Payment');
      case 3: return this.t('ملغى', 'Cancelled');
      case 4: return this.t('مكتمل', 'Completed');
      case 7: return this.t('منتهي الصلاحية', 'Expired');
      default: return this.t('غير معروف', 'Unknown');
    }
  }

  protected statusClass(b: GuestBooking): string {
    switch (b.status) {
      case 3:
      case 7: return 'badge-danger';
      case 4: return 'badge-muted';
      case 2: return 'badge-success';
      case 6: return 'badge-warn';
      case 1: return 'badge-teal';
      default: return 'badge-muted';
    }
  }

  /** True if guest needs to pay (Approved or Confirmed-without-payment). */
  protected needsPayment(b: GuestBooking): boolean {
    return b.status === 6 || (b.status === 2 && b.paymentStatus !== 2);
  }

  /** True if guest can cancel (Pending or Approved). */
  protected canCancel(b: GuestBooking): boolean {
    return b.status === 1 || b.status === 6;
  }

  /** True if booking is fully confirmed and paid (can show directions/chat). */
  protected isActive(b: GuestBooking): boolean {
    return b.status === 2 && b.paymentStatus === 2;
  }

  /** Hours remaining in the 24-hour payment window, or null. */
  protected paymentDeadlineHours(b: GuestBooking): number | null {
    if (b.status !== 6 || !b.approvedAt) return null;
    const deadline = new Date(b.approvedAt).getTime() + 24 * 60 * 60 * 1000;
    const remaining = Math.floor((deadline - Date.now()) / (1000 * 60 * 60));
    return remaining > 0 ? remaining : 0;
  }

  // ── Actions ───────────────────────────────────────────────────────

  protected cancelBooking(id: string): void {
    if (!confirm(this.t('هل أنت متأكد من إلغاء هذا الحجز؟', 'Are you sure you want to cancel this booking?'))) return;
    this.cancellingId.set(id);
    this.guestBookingService.cancelBooking(id).subscribe({
      next: () => {
        // Reactively update status to Cancelled (3)
        this.bookings.update((list) =>
          list.map((b) => b.id === id ? { ...b, status: 3 as const } : b),
        );
        this.cancellingId.set(null);
      },
      error: () => {
        alert(this.t('تعذر إلغاء الحجز، حاول مجدداً', 'Failed to cancel booking, please try again.'));
        this.cancellingId.set(null);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(
      this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );
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
}
