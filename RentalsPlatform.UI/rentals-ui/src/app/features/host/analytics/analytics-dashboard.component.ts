import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ApexOptions } from 'apexcharts';

import { AnalyticsStore } from '../state/analytics.store';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class AnalyticsDashboardComponent implements OnInit {
  protected readonly analyticsStore = inject(AnalyticsStore);
  protected readonly lang = inject(LanguageService);

  protected readonly kpiCards = computed(() => [
    {
      id: 'earnings',
      label: this.t('إجمالي الإيرادات', 'Total Earnings'),
      value: this.formatCurrency(this.analyticsStore.totalEarnings()),
      trend: '+12%',
      positive: true,
    },
    {
      id: 'bookings',
      label: this.t('إجمالي الحجوزات', 'Total Bookings'),
      value: this.analyticsStore.totalBookings().toString(),
      trend: '+8%',
      positive: true,
    },
  ]);

  protected readonly revenueChartSeries = computed(() => [
    {
      name: this.t('الإيرادات', 'Revenue'),
      data: this.analyticsStore.revenueData().map((item) => item.revenue),
    },
  ]);

  protected readonly revenueChartCategories = computed(() =>
    this.analyticsStore.revenueData().map((item) => item.month),
  );

  protected readonly occupancyChartSeries = computed(() => [
    this.analyticsStore.occupancyRate(),
  ]);

  protected readonly revenueChartOptions = computed<ApexOptions>(() => {
    const options: ApexOptions = {
      chart: {
        type: 'area',
        sparkline: { enabled: false },
        toolbar: { show: false },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        zoom: { enabled: false },
        animations: {
          enabled: true,
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 50,
          },
          dynamicAnimation: {
            enabled: true,
            speed: 150,
          },
        },
      } as any,
      colors: ['#0f766e'],
      stroke: {
        curve: 'smooth',
        width: 3,
        lineCap: 'round',
        lineJoin: 'round',
      } as any,
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.75,
          opacityTo: 0.02,
          stops: [0, 100],
          colorStops: [
            { offset: 0, color: 'rgba(15, 118, 110, 0.8)', opacity: 1 },
            { offset: 100, color: 'rgba(15, 118, 110, 0)', opacity: 0.1 },
          ],
        },
      } as any,
      xaxis: {
        categories: this.revenueChartCategories(),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: {
            colors: 'rgba(23, 32, 51, 0.58)',
            fontSize: '0.82rem',
            fontWeight: 500,
          },
        },
      } as any,
      yaxis: {
        labels: {
          style: {
            colors: 'rgba(23, 32, 51, 0.58)',
            fontSize: '0.82rem',
            fontWeight: 500,
          },
          formatter: (value: number) => {
            if (value >= 1000) {
              return `$${(value / 1000).toFixed(0)}K`;
            }
            return `$${value}`;
          },
        },
      } as any,
      grid: {
        show: false,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      } as any,
      tooltip: {
        enabled: true,
        theme: 'light',
        style: {
          fontSize: '0.85rem',
          fontFamily: 'inherit',
        },
        x: {
          formatter: (val: number) => {
            const categories = this.revenueChartCategories();
            return categories[val] || '';
          },
        },
        y: {
          formatter: (val: number) => this.formatCurrency(val),
          title: {
            formatter: () => this.t('الإيرادات', 'Revenue'),
          },
        },
      } as any,
      dataLabels: { enabled: false },
      markers: {
        size: 0,
        hover: { size: 6, sizeOffset: 3 },
        strokeWidth: 0,
        colors: ['#0f766e'],
      } as any,
    };
    return options;
  });

  protected readonly occupancyChartOptions = computed<ApexOptions>(() => {
    const options: ApexOptions = {
      chart: {
        type: 'radialBar',
        toolbar: { show: false },
        animations: {
          enabled: true,
          speed: 1000,
        },
      } as any,
      colors: ['#0f766e'],
      plotOptions: {
        radialBar: {
          size: 135,
          hollow: {
            size: '45%',
            background: 'transparent',
          },
          track: {
            background: 'rgba(0, 0, 0, 0.08)',
            strokeWidth: '97%',
            margin: 8,
          },
          dataLabels: {
            name: {
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'rgba(23, 32, 51, 0.76)',
              offsetY: 8,
            },
            value: {
              fontSize: '1.8rem',
              fontWeight: 700,
              color: '#172033',
              formatter: (val: number) => `${Math.round(val)}%`,
            },
          },
        },
      } as any,
      labels: [this.t('الإشغال', 'Occupancy')],
      tooltip: {
        enabled: true,
        theme: 'light',
        y: {
          formatter: (val: number) => `${val}%`,
          title: {
            formatter: () => this.t('الإشغال', 'Occupancy'),
          },
        },
      } as any,
    };
    return options;
  });

  async ngOnInit(): Promise<void> {
    await this.analyticsStore.loadStats(this.lang.currentLang() === 'ar' ? 1445 : 2025);
  }

  protected formatCurrency(amount: number): string {
    const locale = this.lang.currentLang() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
