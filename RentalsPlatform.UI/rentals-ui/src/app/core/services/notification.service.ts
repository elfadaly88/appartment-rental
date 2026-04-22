import { Injectable, signal, computed, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

export interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private hubConnection: signalR.HubConnection | undefined;

  // ── State Signals ───────────────────────────────────────────────────────
  private readonly _notifications = signal<NotificationMessage[]>([]);
  private readonly _connectionState = signal<signalR.HubConnectionState>(
    signalR.HubConnectionState.Disconnected,
  );

  /** Read-only signal of all received notifications (newest first). */
  readonly notifications = this._notifications.asReadonly();

  /** The most recent notification, or null. */
  readonly latestNotification = computed(() => this._notifications()[0] ?? null);

  /** Current hub connection state. */
  readonly connectionState = this._connectionState.asReadonly();

  readonly isConnected = computed(
    () => this._connectionState() === signalR.HubConnectionState.Connected,
  );

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Open the WebSocket connection to the SignalR hub.
   * The JWT token is sent as `access_token` query-string parameter
   * (standard SignalR auth negotiation).
   */
  async start(jwtToken: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return; // SSR — no WebSocket
    }

    // Don't reconnect if already connected
    if (
      this.hubConnection &&
      this.hubConnection.state === signalR.HubConnectionState.Connected
    ) {
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.resolveHubUrl(environment.hubUrl), {
        accessTokenFactory: () => jwtToken,
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.registerHubCallbacks();

    try {
      await this.hubConnection.start();
      this._connectionState.set(this.hubConnection.state);
    } catch (err) {
      console.error('[NotificationService] Connection failed:', err);
      this._connectionState.set(signalR.HubConnectionState.Disconnected);
    }
  }

  /**
   * Starts SignalR connection using JWT token from URL query-string first,
   * then falls back to localStorage('jwtToken').
   */
  async startConnection(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const search = new URLSearchParams(window.location.search);
    const tokenFromUrl = search.get('token') ?? search.get('access_token');
    const tokenFromStorage = localStorage.getItem('jwtToken');
    const jwtToken = tokenFromUrl ?? tokenFromStorage ?? '';

    if (!jwtToken) {
      console.warn('[NotificationService] No JWT token found for SignalR connection.');
      void this.router.navigate(['/auth']);
      return;
    }

    if (this.isJwtExpired(jwtToken)) {
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('token');
      console.warn('[NotificationService] JWT token expired. Redirecting to login.');
      void this.router.navigate(['/auth']);
      return;
    }

    await this.start(jwtToken);
  }

  /** Gracefully close the hub connection. */
  async stop(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this._connectionState.set(signalR.HubConnectionState.Disconnected);
    }
  }

  /** Clear all stored notifications. */
  clearAll(): void {
    this._notifications.set([]);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private registerHubCallbacks(): void {
    if (!this.hubConnection) return;

    // Listen for messages from the server hub method "ReceiveNotification"
    this.hubConnection.on('ReceiveNotification', (message: NotificationMessage) => {
      this._notifications.update((list) => [message, ...list]);
    });

    this.hubConnection.onreconnecting(() => {
      this._connectionState.set(signalR.HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(() => {
      this._connectionState.set(signalR.HubConnectionState.Connected);
    });

    this.hubConnection.onclose(() => {
      this._connectionState.set(signalR.HubConnectionState.Disconnected);
    });
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
}