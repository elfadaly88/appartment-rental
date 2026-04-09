import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetLink: string;
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

  private normalizeNotification(payload: Partial<AppNotification>): AppNotification {
    return {
      id:
        payload.id?.trim() ||
        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: payload.title?.trim() || 'New booking update',
      message: payload.message?.trim() || 'A new activity needs your attention.',
      targetLink: payload.targetLink?.trim() || '/host/bookings',
      createdAt: payload.createdAt || new Date().toISOString(),
      isRead: payload.isRead ?? false,
    };
  }
}
