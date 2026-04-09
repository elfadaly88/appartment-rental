import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PropertyDto } from '../../../shared/models/property.dto';

@Component({
  selector: 'app-property-details',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyDetailsComponent {
  readonly propertyId = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly property = signal<PropertyDto | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Browser-only UI state. These values are set from window/document/localStorage.
  protected readonly viewportWidth = signal<number>(0);
  protected readonly isFavorite = signal(false);
  protected readonly lastViewedPropertyId = signal<string | null>(null);

  protected readonly propertyName = computed(() => {
    const p = this.property();
    return p?.title || p?.name || '';
  });

  constructor() {
    // SSR-safe browser API access:
    // afterNextRender ensures this callback runs after render and prevents Node SSR crashes.
    // We still guard with isPlatformBrowser because window/document/localStorage are browser-only.
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      // Safe browser access examples requested for SSR:
      this.viewportWidth.set(window.innerWidth);
      this.lastViewedPropertyId.set(localStorage.getItem('lastViewedPropertyId'));
      this.isFavorite.set(localStorage.getItem(this.favoriteKey()) === '1');

      // DOCUMENT is injected instead of global document for platform safety/testability.
      this.document.title = this.propertyName() || 'Property Details';
    });

    void this.loadProperty();

    this.destroyRef.onDestroy(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      // Keep this light: store last viewed property for browser UX continuity.
      localStorage.setItem('lastViewedPropertyId', this.propertyId());
    });
  }

  protected async loadProperty(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // SSR requirement: absolute URL (do NOT use relative '/api/...').
      // Relative URLs often fail in Node SSR because there is no browser origin context.
      const absoluteUrl = `${environment.apiUrl}/properties/${encodeURIComponent(this.propertyId())}`;

      const dto = await firstValueFrom(this.http.get<PropertyDto>(absoluteUrl));
      this.property.set(dto);

      if (isPlatformBrowser(this.platformId)) {
        this.document.title = dto.title || dto.name || 'Property Details';
      }
    } catch (err) {
      this.error.set('Failed to load property details.');
      console.error('[PropertyDetailsComponent] loadProperty failed', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected toggleFavorite(): void {
    const next = !this.isFavorite();
    this.isFavorite.set(next);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.favoriteKey(), next ? '1' : '0');
  }

  private favoriteKey(): string {
    return `favorite.property.${this.propertyId()}`;
  }
}
