import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HostStore } from '../state/host.store';
import { LanguageService } from '../../../core/services/language.service';
import { PushPromptComponent } from '../components/push-prompt.component';
import { AnalyticsDashboardComponent } from '../analytics/analytics-dashboard.component';

@Component({
  selector: 'app-host-dashboard',
  imports: [RouterLink, PushPromptComponent, AnalyticsDashboardComponent],
  templateUrl: './host-dashboard.component.html',
  styleUrl: './host-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class HostDashboardComponent implements OnInit {
  protected readonly hostStore = inject(HostStore);
  protected readonly lang = inject(LanguageService);

  protected readonly statCards = computed(() => [
    {
      id: 'earnings',
      label: this.t('إجمالي الإيرادات', 'Total Earnings'),
      value: this.formatCurrency(this.hostStore.totalEarnings()),
    },
    {
      id: 'bookings',
      label: this.t('الحجوزات النشطة', 'Active Bookings'),
      value: this.hostStore.activeBookingsCount().toString(),
    },
    {
      id: 'properties',
      label: this.t('إجمالي العقارات', 'Properties'),
      value: this.hostStore.totalPropertiesCount().toString(),
    },
  ]);

  ngOnInit(): void {
    this.hostStore.loadDashboardData();
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  protected formatCurrency(amount: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected formatDate(iso: string): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  }

  protected bookingStatusLabel(status: 'active' | 'completed' | 'cancelled'): string {
    if (status === 'active') return this.t('نشط', 'Active');
    if (status === 'completed') return this.t('مكتمل', 'Completed');
    return this.t('ملغي', 'Cancelled');
  }
}
