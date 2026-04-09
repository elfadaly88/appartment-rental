import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface RevenueDataPoint {
  month: string;
  revenue: number;
}

export interface OccupancyDataPoint {
  month: string;
  occupancy: number;
}

export interface DashboardStats {
  totalEarnings: number;
  totalBookings: number;
  occupancyRate: number;
  revenueByMonth: RevenueDataPoint[];
  occupancyByMonth: OccupancyDataPoint[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsStore {
  private readonly http = inject(HttpClient);

  private readonly _dashboardStats = signal<DashboardStats | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedYear = signal(new Date().getFullYear());

  readonly dashboardStats = this._dashboardStats.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedYear = this._selectedYear.asReadonly();

  readonly totalEarnings = computed(() => this._dashboardStats()?.totalEarnings ?? 0);
  readonly totalBookings = computed(() => this._dashboardStats()?.totalBookings ?? 0);
  readonly occupancyRate = computed(() => this._dashboardStats()?.occupancyRate ?? 0);
  readonly revenueData = computed(() => this._dashboardStats()?.revenueByMonth ?? []);
  readonly occupancyData = computed(() => this._dashboardStats()?.occupancyByMonth ?? []);

  async loadStats(year: number): Promise<void> {
    this._selectedYear.set(year);
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const stats = await firstValueFrom(
        this.http.get<DashboardStats>(
          `${environment.apiUrl}/analytics/dashboard-stats?year=${year}`,
        ),
      );

      this._dashboardStats.set(stats);
    } catch (error) {
      this._error.set('Unable to load analytics data.');
      console.error('[AnalyticsStore]', error);
    } finally {
      this._isLoading.set(false);
    }
  }
}
