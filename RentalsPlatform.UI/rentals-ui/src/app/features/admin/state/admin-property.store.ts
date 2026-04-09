import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface PendingPropertyDto {
  id: string;
  title: string;
  hostName: string;
  priceAmount: number;
  priceCurrency: string;
  images: string[];
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminPropertyStore {
  private readonly http = inject(HttpClient);

  private readonly _pendingProperties = signal<PendingPropertyDto[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSubmitting = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly pendingProperties = this._pendingProperties.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingCount = computed(() => this._pendingProperties().length);

  async loadPending(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const url = `${environment.apiUrl}/admin/properties/pending`;
      const response = await firstValueFrom(this.http.get<PendingPropertyDto[]>(url));
      this._pendingProperties.set(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('[AdminPropertyStore] loadPending failed', err);
      this._error.set('Failed to load pending properties.');
      this._pendingProperties.set([]);
    } finally {
      this._isLoading.set(false);
    }
  }

  async approve(id: string): Promise<void> {
    if (!id || this._isSubmitting()) {
      return;
    }

    const previous = this._pendingProperties();
    this._isSubmitting.set(true);
    this._error.set(null);

    // Optimistic removal for instant admin workflow.
    this._pendingProperties.set(previous.filter((item) => item.id !== id));

    try {
      const url = `${environment.apiUrl}/admin/properties/${encodeURIComponent(id)}/approve`;
      await firstValueFrom(this.http.post(url, {}));
    } catch (err) {
      console.error('[AdminPropertyStore] approve failed', err);
      this._pendingProperties.set(previous);
      this._error.set('Approval failed. Please try again.');
    } finally {
      this._isSubmitting.set(false);
    }
  }

  async reject(id: string, reason: string): Promise<void> {
    const trimmedReason = reason.trim();
    if (!id || !trimmedReason || this._isSubmitting()) {
      return;
    }

    const previous = this._pendingProperties();
    this._isSubmitting.set(true);
    this._error.set(null);

    // Optimistic removal for fast moderation loop.
    this._pendingProperties.set(previous.filter((item) => item.id !== id));

    try {
      const url = `${environment.apiUrl}/admin/properties/${encodeURIComponent(id)}/reject`;
      await firstValueFrom(
        this.http.post(url, {
          reason: trimmedReason,
        }),
      );
    } catch (err) {
      console.error('[AdminPropertyStore] reject failed', err);
      this._pendingProperties.set(previous);
      this._error.set('Rejection failed. Please try again.');
    } finally {
      this._isSubmitting.set(false);
    }
  }
}
