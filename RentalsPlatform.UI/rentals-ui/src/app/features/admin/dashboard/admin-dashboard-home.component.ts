import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { AdminService, AdminFinancialSummaryDto } from '../admin.service';

@Component({
  selector: 'app-admin-dashboard-home',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './admin-dashboard-home.component.html',
  styleUrl: './admin-dashboard-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardHomeComponent {
  private readonly adminService = inject(AdminService);

  private readonly summary = signal<AdminFinancialSummaryDto | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly totalRevenue = computed(() => this.summary()?.totalRevenue ?? 0);
  protected readonly activeUsers = computed(() => this.summary()?.activeUsers ?? 0);
  protected readonly pendingApprovals = computed(() => this.summary()?.pendingApprovals ?? 0);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const data = await firstValueFrom(this.adminService.getFinancialSummary());
      this.summary.set(data);
    } catch {
      this.error.set('ADMIN.DASHBOARD.ERROR');
      this.summary.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }
}
