import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LanguageService } from '../../../core/services/language.service';
import { AdminUserDto, AdminUserStore } from '../state/admin-user.store';

type UserFilterTab = 'all' | 'hosts' | 'guests' | 'banned';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.dir]': 'lang.dir()',
    '[attr.lang]': 'lang.currentLang()',
  },
})
export class UserManagementComponent {
  protected readonly lang = inject(LanguageService);
  protected readonly store = inject(AdminUserStore);

  protected readonly activeTab = signal<UserFilterTab>('all');
  protected readonly isBanModalOpen = signal(false);
  protected readonly selectedUser = signal<AdminUserDto | null>(null);
  protected readonly banReason = signal('');
  protected readonly modalError = signal<string | null>(null);

  protected readonly tabs = computed(() => [
    {
      id: 'all' as const,
      label: this.t('الكل', 'All'),
      count: this.store.users().length,
    },
    {
      id: 'hosts' as const,
      label: this.t('المضيفون', 'Hosts'),
      count: this.store.hostsOnly().length,
    },
    {
      id: 'guests' as const,
      label: this.t('الضيوف', 'Guests'),
      count: this.store.guestsOnly().length,
    },
    {
      id: 'banned' as const,
      label: this.t('المحظورون', 'Banned'),
      count: this.store.bannedUsers().length,
    },
  ]);

  protected readonly visibleUsers = computed(() => {
    switch (this.activeTab()) {
      case 'hosts':
        return this.store.hostsOnly();
      case 'guests':
        return this.store.guestsOnly();
      case 'banned':
        return this.store.bannedUsers();
      default:
        return this.store.users();
    }
  });

  constructor() {
    void this.store.loadUsers();
  }

  protected setTab(tab: UserFilterTab): void {
    this.activeTab.set(tab);
  }

  protected async refresh(): Promise<void> {
    await this.store.loadUsers();
  }

  protected roleLabel(role: string): string {
    const normalized = role?.toLowerCase();
    if (normalized === 'host') {
      return this.t('مضيف', 'Host');
    }
    if (normalized === 'guest') {
      return this.t('ضيف', 'Guest');
    }
    return this.t('مدير', 'Admin');
  }

  protected roleClass(role: string): string {
    const normalized = role?.toLowerCase();
    if (normalized === 'admin') {
      return 'badge--role-admin';
    }
    if (normalized === 'host') {
      return 'badge--role-host';
    }
    return 'badge--role-guest';
  }

  protected getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  protected statusLabel(isBanned: boolean): string {
    return isBanned ? this.t('محظور', 'Banned') : this.t('نشط', 'Active');
  }

  protected openBanModal(user: AdminUserDto): void {
    this.selectedUser.set(user);
    this.banReason.set('');
    this.modalError.set(null);
    this.isBanModalOpen.set(true);
  }

  protected closeBanModal(): void {
    this.isBanModalOpen.set(false);
    this.selectedUser.set(null);
    this.banReason.set('');
    this.modalError.set(null);
  }

  protected updateBanReason(value: string): void {
    this.banReason.set(value);
    if (value.trim().length > 0 && this.modalError()) {
      this.modalError.set(null);
    }
  }

  protected async confirmBan(): Promise<void> {
    const user = this.selectedUser();
    const reason = this.banReason().trim();

    if (!user) {
      return;
    }

    if (!reason) {
      this.modalError.set(this.t('سبب الحظر مطلوب', 'Reason for banning is required.'));
      return;
    }

    await this.store.banUser(user.id, reason);
    if (!this.store.error()) {
      this.closeBanModal();
    }
  }

  protected async unban(user: AdminUserDto): Promise<void> {
    await this.store.unbanUser(user.id);
  }

  protected t(ar: string, en: string): string {
    return this.lang.currentLang() === 'ar' ? ar : en;
  }
}
