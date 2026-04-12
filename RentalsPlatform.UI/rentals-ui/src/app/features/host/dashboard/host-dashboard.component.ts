import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../../core/services/language.service';
import { PropertyService } from '../services/property.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './host-dashboard.component.html',
  styleUrl: './host-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class HostDashboardComponent implements OnInit {
  protected readonly lang = inject(LanguageService);
  protected readonly propertyService = inject(PropertyService);
  protected readonly bookingSearch = signal('');
  protected readonly processingId = signal<string | null>(null);

  protected readonly statCards = computed(() => [
    {
      id: 'earnings',
      icon: '💰',
      label: this.t('إجمالي الإيرادات', 'Total Earnings'),
      value: this.formatCurrency(this.propertyService.dashboard()?.totalEarnings ?? 0),
    },
    {
      id: 'projected',
      icon: '📈',
      label: this.t('الدخل المتوقع', 'Projected Income'),
      value: this.formatCurrency(this.propertyService.dashboard()?.projectedIncome ?? 0),
    },
    {
      id: 'properties',
      icon: '🏠',
      label: this.t('العقارات النشطة', 'Active Listings'),
      value: String(this.propertyService.dashboard()?.activeListings ?? 0),
    },
    {
      id: 'occupancy',
      icon: '📊',
      label: this.t('معدل الإشغال', 'Occupancy Rate'),
      value: `${this.propertyService.dashboard()?.occupancyRate ?? 0}%`,
    },
  ]);

  protected readonly filteredBookings = computed(() => {
    const query = this.bookingSearch().trim().toLowerCase();
    const bookings = this.propertyService.pipelineBookings();
    if (!query) return bookings;
    return bookings.filter((b) =>
      [b.propertyTitle, b.guestName, b.pipelineStatus].join(' ').toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    void this.propertyService.loadDashboard();
    void this.propertyService.loadPipeline();
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected formatCurrency(amount: number, currency = 'EGP'): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  }

  protected bookingStatusLabel(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':   return this.t('بانتظار الموافقة', 'Pending');
      case 'approved':  return this.t('تم الموافقة', 'Approved');
      case 'arriving':  return this.t('وصول اليوم', 'Arriving Today');
      case 'confirmed': return this.t('مؤكد', 'Confirmed');
      default:          return status;
    }
  }

  protected bookingStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending':   return 'status-badge status-badge--pending';
      case 'approved':  return 'status-badge status-badge--approved';
      case 'arriving':  return 'status-badge status-badge--arriving';
      case 'confirmed': return 'status-badge status-badge--confirmed';
      default:          return 'status-badge';
    }
  }

  protected propertyStatusLabel(status: string | number | null | undefined): string {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === '2') return this.t('نشط', 'Active');
    if (normalized === 'rejected' || normalized === '3') return this.t('مرفوض', 'Rejected');
    return this.t('قيد المراجعة', 'Pending');
  }

  protected updateSearch(value: string): void {
    this.bookingSearch.set(value);
  }

  protected async approveBooking(bookingId: string): Promise<void> {
    this.processingId.set(bookingId);
    await this.propertyService.approveBooking(bookingId);
    this.processingId.set(null);
  }

  protected async rejectBooking(bookingId: string): Promise<void> {
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

    if (!isConfirmed || !reason?.trim()) return;

    this.processingId.set(bookingId);
    await this.propertyService.rejectBooking(bookingId, reason.trim());
    this.processingId.set(null);
  }

  protected async confirmCheckIn(bookingId: string): Promise<void> {
    this.processingId.set(bookingId);
    await this.propertyService.confirmCheckIn(bookingId);
    this.processingId.set(null);
  }

  /** Returns hours remaining of the 24-h soft-block, or null. */
  protected softBlockHours(softBlockUntil: string | null | undefined): number | null {
    if (!softBlockUntil) return null;
    const remaining = Math.floor((new Date(softBlockUntil).getTime() - Date.now()) / (1000 * 60 * 60));
    return remaining > 0 ? remaining : null;
  }
}
