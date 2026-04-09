import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexFill, ApexGrid, ApexMarkers, ApexStroke, ApexTooltip, ApexXAxis, ApexYAxis, NgApexchartsModule } from 'ng-apexcharts';

import { LanguageService } from '../../../core/services/language.service';
import { AdminDashboardStore } from '../state/admin-dashboard.store';

@Component({
  selector: 'app-master-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './master-dashboard.component.html',
  styleUrl: './master-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class MasterDashboardComponent {
  protected readonly lang = inject(LanguageService);
  protected readonly store = inject(AdminDashboardStore);

  protected readonly revenueLabel = computed(() =>
    this.t('إجمالي الإيرادات', 'Total Revenue'),
  );
  protected readonly bookingsLabel = computed(() =>
    this.t('الحجوزات النشطة', 'Active Bookings'),
  );
  protected readonly growthLabel = computed(() =>
    this.t('النمو الشهري', 'Monthly Growth'),
  );

  protected readonly isGrowthPositive = computed(() => this.store.monthlyGrowth() >= 0);

  protected readonly formattedRevenue = computed(() => {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    const currency = 'USD';

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(this.store.totalRevenue());
    } catch {
      return `${currency} ${Math.round(this.store.totalRevenue()).toLocaleString(locale)}`;
    }
  });

  protected readonly formattedGrowth = computed(() => {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return `${this.store.monthlyGrowth().toLocaleString(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  });

  protected readonly revenueSeries = computed<ApexAxisChartSeries>(() => [
    {
      name: this.t('الإيراد', 'Revenue'),
      data: this.store.monthlyRevenueTrend().map((point) => point.revenue),
    },
  ]);

  protected readonly chartOptions = computed(() => {
    const categories = this.store.monthlyRevenueTrend().map((point) => point.month);

    const chart: ApexChart = {
      type: 'area',
      height: 360,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        speed: 700,
        animateGradually: { enabled: true, delay: 80 },
        dynamicAnimation: { enabled: true, speed: 320 },
      },
    };

    const stroke: ApexStroke = {
      curve: 'smooth',
      width: 3,
      colors: ['#1d4ed8'],
    };

    const fill: ApexFill = {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.6,
        opacityFrom: 0.45,
        opacityTo: 0.03,
        stops: [0, 85, 100],
        colorStops: [
          { offset: 0, color: '#1d4ed8', opacity: 0.48 },
          { offset: 100, color: '#1d4ed8', opacity: 0.02 },
        ],
      },
    };

    const xaxis: ApexXAxis = {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: 'rgba(15, 23, 42, 0.55)',
          fontSize: '12px',
          fontWeight: '500',
        },
      },
    };

    const yaxis: ApexYAxis = {
      labels: {
        formatter: (value: number) => {
          const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
          return new Intl.NumberFormat(locale, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(value);
        },
        style: {
          colors: 'rgba(15, 23, 42, 0.5)',
          fontSize: '12px',
          fontWeight: '500',
        },
      },
    };

    const grid: ApexGrid = {
      borderColor: 'rgba(15, 23, 42, 0.08)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    };

    const tooltip: ApexTooltip = {
      y: {
        formatter: (value: number) => this.formatCurrency(value),
      },
      theme: 'light',
    };

    const dataLabels: ApexDataLabels = {
      enabled: false,
    };

    const markers: ApexMarkers = {
      size: 0,
      hover: { size: 6 },
    };

    return {
      chart,
      stroke,
      fill,
      xaxis,
      yaxis,
      grid,
      tooltip,
      dataLabels,
      markers,
      colors: ['#1d4ed8'],
    };
  });

  constructor() {
    void this.store.loadStats();
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }

  private formatCurrency(value: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `USD ${Math.round(value).toLocaleString(locale)}`;
    }
  }
}
