import {
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  IHttpConnectionOptions,
  LogLevel,
} from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../state/auth.store';
import { NotificationStore } from '../state/notification.store';

export interface RealtimeNotification {
  id: string;
  guestName?: string;
  propertyName?: string;
  title?: string;
  message?: string;
  targetLink?: string;
  createdAt: string;
  raw: unknown;
}

@Injectable({ providedIn: 'root' })
export class SignalrService implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly notificationStore = inject(NotificationStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  private hubConnection: HubConnection | null = null;
  private retryTimerId: ReturnType<typeof setTimeout> | null = null;

  readonly notifications = signal<RealtimeNotification[]>([]);
  readonly connectionState = signal<HubConnectionState>(HubConnectionState.Disconnected);
  readonly isConnected = computed(
    () => this.connectionState() === HubConnectionState.Connected,
  );

  async startConnection(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      void this.router.navigate(['/auth']);
      return;
    }

    if (
      this.hubConnection &&
      (this.hubConnection.state === HubConnectionState.Connected ||
        this.hubConnection.state === HubConnectionState.Connecting ||
        this.hubConnection.state === HubConnectionState.Reconnecting)
    ) {
      return;
    }

    if (!this.hubConnection) {
      this.buildConnection();
    }

    if (!this.hubConnection) {
      return;
    }

    try {
      await this.hubConnection.start();
      this.connectionState.set(this.hubConnection.state);
    } catch {
      this.connectionState.set(HubConnectionState.Disconnected);
      this.scheduleReconnect();
    }
  }

  async stopConnection(): Promise<void> {
    if (this.retryTimerId) {
      clearTimeout(this.retryTimerId);
      this.retryTimerId = null;
    }

    if (!this.hubConnection) {
      return;
    }

    await this.hubConnection.stop();
    this.connectionState.set(HubConnectionState.Disconnected);
  }

  removeNotification(id: string): void {
    this.notifications.update((current) => current.filter((item) => item.id !== id));
  }

  clearNotifications(): void {
    this.notifications.set([]);
  }

  ngOnDestroy(): void {
    void this.stopConnection();
  }

  private buildConnection(): void {
    const url = environment.hubUrl;

    const options: IHttpConnectionOptions = {
      accessTokenFactory: () => this.getAuthToken(),
    };

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(url, options)
      .withAutomaticReconnect([0, 1500, 5000, 10000, 20000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.hubConnection.off('ReceiveNotification');
    this.hubConnection.on('ReceiveNotification', (payload: unknown) => {
      const notification = this.normalizeNotification(payload);
      this.notifications.update((current) => [notification, ...current]);
      this.notificationStore.addNotification({
        id: notification.id,
        title:
          notification.title ||
          this.composeDefaultTitle(notification.guestName, notification.propertyName),
        message:
          notification.message ||
          this.composeDefaultMessage(notification.guestName, notification.propertyName),
        createdAt: notification.createdAt,
        isRead: false,
        targetLink: notification.targetLink || '/host/bookings',
      });
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionState.set(HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(() => {
      this.connectionState.set(HubConnectionState.Connected);
    });

    this.hubConnection.onclose(() => {
      this.connectionState.set(HubConnectionState.Disconnected);
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (!isPlatformBrowser(this.platformId) || this.retryTimerId) {
      return;
    }

    this.retryTimerId = setTimeout(() => {
      this.retryTimerId = null;
      void this.startConnection();
    }, 4000);
  }

  private getAuthToken(): string {
    this.authStore.initAuth();

    if (!isPlatformBrowser(this.platformId)) {
      return '';
    }

    return localStorage.getItem('jwtToken') ?? '';
  }

  private normalizeNotification(payload: unknown): RealtimeNotification {
    const source = (payload ?? {}) as Record<string, unknown>;

    const guestName =
      this.readString(source, ['guestName', 'GuestName', 'guest']) || undefined;

    const propertyName =
      this.readString(source, ['propertyName', 'PropertyName', 'property']) || undefined;

    const title = this.readString(source, ['title', 'Title']) || undefined;
    const message = this.readString(source, ['message', 'Message', 'body', 'Body']) || undefined;
    const id =
      this.readString(source, ['id', 'Id', 'notificationId']) ||
      `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      id,
      guestName,
      propertyName,
      title,
      message,
      targetLink:
        this.readString(source, ['targetLink', 'TargetLink', 'link']) || undefined,
      createdAt: new Date().toISOString(),
      raw: payload,
    };
  }

  private readString(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private composeDefaultTitle(guestName?: string, propertyName?: string): string {
    if (guestName && propertyName) {
      return `${guestName} booked ${propertyName}`;
    }
    if (propertyName) {
      return `New booking inquiry for ${propertyName}`;
    }
    return 'New booking update';
  }

  private composeDefaultMessage(guestName?: string, propertyName?: string): string {
    if (guestName && propertyName) {
      return `${guestName} has requested to reserve ${propertyName}.`;
    }
    if (guestName) {
      return `${guestName} sent a new booking request.`;
    }
    return 'A new booking activity needs your attention.';
  }
}
