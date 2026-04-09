import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface MonthlyRevenuePointDto {
  month: string;
  revenue: number;
}

export interface AdminMasterStatsDto {
  totalRevenue: number;
  activeBookings: number;
  monthlyGrowth: number;
  monthlyRevenueTrend: MonthlyRevenuePointDto[];
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardStore {
  private readonly http = inject(HttpClient);

  private readonly _masterStats = signal<AdminMasterStatsDto | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly masterStats = this._masterStats.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly totalRevenue = computed(() => this._masterStats()?.totalRevenue ?? 0);
  readonly activeBookings = computed(() => this._masterStats()?.activeBookings ?? 0);
  readonly monthlyGrowth = computed(() => this._masterStats()?.monthlyGrowth ?? 0);
  readonly monthlyRevenueTrend = computed(() => this._masterStats()?.monthlyRevenueTrend ?? []);

  async loadStats(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const url = `${environment.apiUrl}/admin-dashboard/stats`;
      const response = await firstValueFrom(this.http.get<AdminMasterStatsDto>(url));
      this._masterStats.set(response);
    } catch (err) {
      console.error('[AdminDashboardStore] loadStats failed', err);
      this._masterStats.set(null);
      this._error.set('Failed to load dashboard statistics.');
    } finally {
      this._isLoading.set(false);
    }
  }
}
