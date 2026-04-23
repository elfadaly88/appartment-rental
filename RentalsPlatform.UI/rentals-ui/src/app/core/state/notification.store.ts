import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

export type NotificationTargetType = 'Booking' | 'Property' | 'Approval' | 'Message' | 'System';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetType?: NotificationTargetType;
  targetId?: string;
  targetLink?: string;
  createdAt: string;
  isRead: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly http = inject(HttpClient);

  private readonly _notifications = signal<AppNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(
    () => this._notifications().filter((item) => !item.isRead).length,
  );

  async loadFromApi(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<AppNotification[]>(`${environment.apiUrl}/notifications`),
      );

      const normalized = (response ?? []).map((item) => this.normalizeNotification(item));
      this._notifications.set(this.sortNewestFirst(normalized));
    } catch {
      // Keep app resilient if endpoint is not available yet.
      this._notifications.set([]);
    }
  }

  addNotification(notification: Partial<AppNotification>): void {
    const next = this.normalizeNotification(notification);

    this._notifications.update((current) => {
      const filtered = current.filter((item) => item.id !== next.id);
      return [next, ...filtered];
    });
  }

  async markAsRead(id: string): Promise<void> {
    this._notifications.update((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );

    try {
      // The API route expects a GUID id (see NotificationsController.[HttpPatch("{id:guid}/read")] ).
      // For dev/test notifications we generate non-GUID ids (e.g. "test-...") — skip
      // the server call in that case to avoid 404s while preserving optimistic UI update.
      const guidRegex = /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/;
      if (!guidRegex.test(id)) {
        return;
      }

      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/notifications/${id}/read`, {}),
      );
    } catch {
      // Keep optimistic update for UX smoothness even if API call fails.
    }
  }

  private sortNewestFirst(list: AppNotification[]): AppNotification[] {
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private normalizeNotification(payload: any): AppNotification {
    const source = payload || {};

    const id = this.readString(source, ['id', 'Id', 'notificationId']) ||
      `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const title = this.readString(source, ['title', 'Title']) || 'Notification';
    const message = this.readString(source, ['message', 'Message', 'body', 'Body']) || 'New update available.';

    const targetType = (this.readString(source, ['targetType', 'TargetType']) as NotificationTargetType) ||
      (source.bookingId || source.BookingId ? 'Booking' : source.propertyId || source.PropertyId ? 'Property' : 'System');

    const targetId = this.readString(source, ['targetId', 'TargetId', 'bookingId', 'BookingId', 'propertyId', 'PropertyId']);

    const targetLink = this.readString(source, ['targetLink', 'TargetLink']) || undefined;
    const createdAt = this.readString(source, ['createdAt', 'CreatedAt', 'timestamp', 'Timestamp']) || new Date().toISOString();
    const isRead = !!(source.isRead ?? source.IsRead ?? false);

    return {
      id,
      title,
      message,
      targetType,
      targetId,
      targetLink,
      createdAt,
      isRead,
    };
  }

  private readString(source: any, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  reset(): void {
    this._notifications.set([]);
  }
}
