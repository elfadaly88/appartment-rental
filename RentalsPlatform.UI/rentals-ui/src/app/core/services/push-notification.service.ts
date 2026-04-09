import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

export type PushPermissionState = NotificationPermission | 'unsupported';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _permissionState = signal<PushPermissionState>('default');
  private readonly _isBusy = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _lastForegroundMessage = signal<unknown>(null);

  readonly permissionState = this._permissionState.asReadonly();
  readonly isBusy = this._isBusy.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastForegroundMessage = this._lastForegroundMessage.asReadonly();

  readonly isSupported = computed(() => {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return this.swPush.isEnabled && 'Notification' in window;
  });

  readonly isEnabled = computed(() => this.permissionState() === 'granted');

  constructor() {
    this.syncPermissionState();
    this.listenToForegroundMessages();
  }

  async requestPermissionAndSubscribe(): Promise<'subscribed' | 'denied' | 'unsupported' | 'failed'> {
    this._error.set(null);

    if (!this.isSupported()) {
      this._permissionState.set('unsupported');
      return 'unsupported';
    }

    if (!environment.push.vapidPublicKey.trim()) {
      this._error.set('Missing VAPID public key.');
      return 'failed';
    }

    this._isBusy.set(true);

    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: environment.push.vapidPublicKey,
      });

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/notifications/push/subscribe`, subscription),
      );

      this._permissionState.set('granted');
      return 'subscribed';
    } catch (error) {
      this.syncPermissionState();

      if (this.permissionState() === 'denied') {
        return 'denied';
      }

      this._error.set(this.readErrorMessage(error));
      return 'failed';
    } finally {
      this._isBusy.set(false);
    }
  }

  private listenToForegroundMessages(): void {
    if (!isPlatformBrowser(this.platformId) || !this.swPush.isEnabled) {
      return;
    }

    this.swPush.messages.subscribe((message) => {
      this._lastForegroundMessage.set(message);
    });
  }

  private syncPermissionState(): void {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) {
      this._permissionState.set('unsupported');
      return;
    }

    this._permissionState.set(Notification.permission);
  }

  private readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Unable to enable push notifications right now.';
  }
}
