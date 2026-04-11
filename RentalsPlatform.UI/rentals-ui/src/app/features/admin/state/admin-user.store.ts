import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

export type AdminUserRole = 'host' | 'guest' | 'admin';

export interface AdminUserDto {
  id: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  isBanned: boolean;
  banReason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminUserStore {
  private readonly http = inject(HttpClient);

  private readonly _users = signal<AdminUserDto[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSubmitting = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly users = this._users.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hostsOnly = computed(() => this._users().filter((u) => u.role === 'host'));
  readonly guestsOnly = computed(() => this._users().filter((u) => u.role === 'guest'));
  readonly bannedUsers = computed(() => this._users().filter((u) => u.isBanned));

  async loadUsers(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const url = `${environment.apiUrl}/admin/users`;
      const response = await firstValueFrom(this.http.get<AdminUserDto[]>(url));
      this._users.set(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('[AdminUserStore] loadUsers failed', err);
      this._error.set('Failed to load users.');
      this._users.set([]);
    } finally {
      this._isLoading.set(false);
    }
  }

  reset(): void {
    this._users.set([]);
    this._error.set(null);
    this._isLoading.set(false);
    this._isSubmitting.set(false);
  }

  async banUser(id: string, reason: string): Promise<void> {
    const trimmedReason = reason.trim();
    if (!id || !trimmedReason || this._isSubmitting()) {
      return;
    }

    const previous = this._users();
    this._isSubmitting.set(true);
    this._error.set(null);

    // Optimistic UI: reflect moderation decision immediately.
    this._users.set(
      previous.map((user) =>
        user.id === id
          ? {
              ...user,
              isBanned: true,
              banReason: trimmedReason,
            }
          : user,
      ),
    );

    try {
      const url = `${environment.apiUrl}/admin/users/${encodeURIComponent(id)}/ban`;
      await firstValueFrom(this.http.post(url, { reason: trimmedReason }));
    } catch (err) {
      console.error('[AdminUserStore] banUser failed', err);
      this._users.set(previous);
      this._error.set('Failed to ban user. Please try again.');
    } finally {
      this._isSubmitting.set(false);
    }
  }

  async unbanUser(id: string): Promise<void> {
    if (!id || this._isSubmitting()) {
      return;
    }

    const previous = this._users();
    this._isSubmitting.set(true);
    this._error.set(null);

    // Optimistic UI: restore access instantly.
    this._users.set(
      previous.map((user) =>
        user.id === id
          ? {
              ...user,
              isBanned: false,
              banReason: null,
            }
          : user,
      ),
    );

    try {
      const url = `${environment.apiUrl}/admin/users/${encodeURIComponent(id)}/unban`;
      await firstValueFrom(this.http.post(url, {}));
    } catch (err) {
      console.error('[AdminUserStore] unbanUser failed', err);
      this._users.set(previous);
      this._error.set('Failed to unban user. Please try again.');
    } finally {
      this._isSubmitting.set(false);
    }
  }
}
