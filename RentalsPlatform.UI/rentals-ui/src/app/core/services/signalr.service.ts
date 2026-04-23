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
  HttpTransportType,
  IHttpConnectionOptions,
  LogLevel,
} from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../state/auth.store';
import { NotificationStore, AppNotification, NotificationTargetType } from '../state/notification.store';

export interface RealtimeNotification {
  id: string;
  bookingId?: string;
  propertyId?: string;
  targetType?: NotificationTargetType;
  targetId?: string;
  eventType?: string;
  guestName?: string;
  propertyName?: string;
  title?: string;
  message?: string;
  createdAt: string;
  raw: unknown;
}

@Injectable({ providedIn: 'root' })
export class SignalrService implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly notificationStore = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private hubConnection: HubConnection | null = null;
  private retryTimerId: any = null;

  readonly connectionState = signal<HubConnectionState>(HubConnectionState.Disconnected);
  readonly notifications = signal<RealtimeNotification[]>([]);
  readonly unreadCount = computed(() => this.notificationStore.unreadCount());

  async handleNotificationClick(notification: AppNotification): Promise<void> {
    // 1. Mark as read immediately
    await this.notificationStore.markAsRead(notification.id);

    // 2. Check Authentication
    // Log debug info to help diagnose navigation issues
    // Use console.log as well to ensure visibility in browsers that filter debug-level logs
    console.log('[Signalr] Notification click', { notification, user: this.authStore.currentUser(), isHost: this.authStore.isHost?.() });
    console.debug('[Signalr] Notification click (debug)', { notification, user: this.authStore.currentUser(), isHost: this.authStore.isHost?.() });

    if (!this.authStore.isAuthenticated()) {
      const targetUrl = this.resolveTargetUrl(notification);
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem('redirectAfterLogin', targetUrl);
      }
      await this.router.navigate(['/auth']);
      return;
    }

    // 3. Resolve Target URL and Navigate
    const targetUrl = this.resolveTargetUrl(notification);

    console.debug('[Signalr] Resolved targetUrl', { targetUrl });
    console.log('[Signalr] Resolved targetUrl', { targetUrl });

    // 4. Role-Based Guard Check (Simplified)
    if (!this.hasPermission(notification.targetType)) {
      await this.router.navigate(['/']); // Redirect to safe page
      return;
    }

    const perm = this.hasPermission(notification.targetType);
    console.log('[Signalr] Permission check result', { targetType: notification.targetType, permitted: perm });
    console.debug('[Signalr] Permission check result (debug)', { targetType: notification.targetType, permitted: perm });

    try {
      // Defer navigation to next microtask to avoid aborts when a navigation
      // is already in progress (prevents InvalidStateError).
      await Promise.resolve();
      await this.router.navigateByUrl(targetUrl);
      console.log('[Signalr] Navigation to targetUrl succeeded', { targetUrl });
    } catch (err) {
      console.log('[Signalr] Navigation to targetUrl aborted or failed', { targetUrl, err });
      console.debug('[Signalr] Navigation to targetUrl aborted or failed (debug)', { targetUrl, err });
    }
  }

  private resolveTargetUrl(notification: AppNotification): string {
    if (notification.targetLink) return notification.targetLink;

    const { targetType, targetId } = notification;

    switch (targetType) {
      case 'Booking':
        // If the notification contains a test/generated id or no id, navigate
        // to the bookings list rather than to an empty details view.
        const isTestId = !targetId || /^test-/i.test(targetId);
        if (this.authStore.isHost()) {
          return isTestId ? `/host/bookings` : `/host/bookings?id=${targetId}`;
        }
        return `/my-bookings`;
      case 'Property':
        return `/properties/${targetId}`;
      case 'Approval':
        return `/admin/dashboard`;
      case 'Message':
        return `/messages/${targetId}`;
      default:
        return '/';
    }
  }

  private hasPermission(targetType?: NotificationTargetType): boolean {
    if (!targetType) return true;

    const role = this.authStore.currentUser()?.role?.toLowerCase();

    if (targetType === 'Approval' && role !== 'admin') return false;
    // Booking notifications should be visible to authenticated users and
    // navigate to the correct bookings page (host or guest). If the role
    // is missing or unexpected, allow the navigation so the app can
    // resolve the proper page (the route guards will still protect pages
    // if the user lacks permissions).
    if (targetType === 'Booking') return true;

    return true;
  }

  async startConnection(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      void this.router.navigate(['/auth']);
      return;
    }

    if (this.isJwtExpired(token)) {
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('token');
      this.connectionState.set(HubConnectionState.Disconnected);
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
    const url = this.resolveHubUrl(environment.hubUrl);

    const options: IHttpConnectionOptions = {
      accessTokenFactory: () => this.getAuthToken(),
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
    };

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(url, options)
      .withAutomaticReconnect([0, 1500, 5000, 10000, 20000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.hubConnection.off('ReceiveNotification');
    this.hubConnection.on('ReceiveNotification', (payload: any) => {
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
        targetType: notification.targetType || (notification.bookingId ? 'Booking' : notification.propertyId ? 'Property' : 'System'),
        targetId: notification.targetId || notification.bookingId || notification.propertyId,
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

  private resolveHubUrl(url: string): string {
    if (!isPlatformBrowser(this.platformId)) {
      return url;
    }

    const pageIsHttps = window.location.protocol === 'https:';
    if (pageIsHttps && url.startsWith('http://')) {
      return `https://${url.slice('http://'.length)}`;
    }

    if (!pageIsHttps && url.startsWith('https://')) {
      return `http://${url.slice('https://'.length)}`;
    }

    return url;
  }

  private isJwtExpired(token: string): boolean {
    try {
      const payloadBase64 = token.split('.')[1] ?? '';
      if (!payloadBase64) {
        return true;
      }

      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded)) as { exp?: number };

      if (typeof payload.exp !== 'number') {
        return false;
      }

      return payload.exp * 1000 <= Date.now() + 30_000;
    } catch {
      return true;
    }
  }

  private normalizeNotification(payload: unknown): RealtimeNotification {
    const source = (payload ?? {}) as Record<string, unknown>;

    const guestName =
      this.readString(source, ['guestName', 'GuestName', 'guest']) || undefined;

    const bookingId =
      this.readString(source, ['bookingId', 'BookingId']) || undefined;

    const propertyId =
      this.readString(source, ['propertyId', 'PropertyId']) || undefined;

    const targetType =
      (this.readString(source, ['targetType', 'TargetType']) as NotificationTargetType) ||
      undefined;

    const targetId =
      this.readString(source, ['targetId', 'TargetId']) || undefined;

    const eventType =
      this.readString(source, ['eventType', 'EventType']) || undefined;

    const propertyName =
      this.readString(source, ['propertyName', 'PropertyName', 'property']) || undefined;

    const title = this.readString(source, ['title', 'Title']) || undefined;
    const message = this.readString(source, ['message', 'Message', 'body', 'Body']) || undefined;
    const id =
      this.readString(source, ['id', 'Id', 'notificationId']) ||
      `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      id,
      bookingId,
      propertyId,
      targetType,
      targetId,
      eventType,
      guestName,
      propertyName,
      title,
      message,
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

      // Accept non-string primitive values (Guid, number) that may come from server
      if (value != null && typeof value !== 'object') {
        try {
          const s = String(value).trim();
          if (s) return s;
        } catch {
          // ignore
        }
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
