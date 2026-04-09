import { Injectable, inject, signal, computed } from '@angular/core';
import { Property } from '../../models/property.model';
import { PropertyService } from '../services/property.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PropertyStore {
  private readonly propertyService = inject(PropertyService);

  // ── State Signals ───────────────────────────────────────────────────────
  private readonly _properties = signal<Property[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // ── Public Selectors ────────────────────────────────────────────────────
  readonly properties = this._properties.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(
    () => !this._isLoading() && this._properties().length === 0 && !this._error(),
  );

  readonly propertyCount = computed(() => this._properties().length);

  // ── Actions ─────────────────────────────────────────────────────────────

  async loadProperties(): Promise<void> {
    // Cache: skip fetch if already loaded
    if (this._properties().length > 0) {
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const data = await firstValueFrom(this.propertyService.getAll());
      this._properties.set(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load properties';
      this._error.set(message);
    } finally {
      this._isLoading.set(false);
    }
  }

  getPropertyById(id: string) {
    return computed(() => this._properties().find((p) => p.id === id) ?? null);
  }

  invalidateCache(): void {
    this._properties.set([]);
  }
}
