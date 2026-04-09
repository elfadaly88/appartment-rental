import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import mapboxgl, { Map, Marker } from 'mapbox-gl';
import { environment } from '../../../../../environments/environment';
import { Property } from '../../../../models/property.model';

@Component({
  selector: 'app-map-view',
  standalone: true,
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapViewComponent {
  readonly properties = input.required<Property[]>();
  readonly propertySelected = output<string>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private map: Map | null = null;
  private markers: Marker[] = [];
  private selectedMarkerEl: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      this.initializeMap();
      this.renderMarkers(this.properties());
    });

    effect(() => {
      this.renderMarkers(this.properties());
    });

    this.destroyRef.onDestroy(() => {
      this.clearMarkers();
      this.map?.remove();
      this.map = null;
    });
  }

  protected locateMe(): void {
    if (!this.map || !isPlatformBrowser(this.platformId) || !('geolocation' in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const center: [number, number] = [coords.longitude, coords.latitude];
        this.map?.flyTo({
          center,
          zoom: 12,
          duration: 1100,
          essential: true,
        });
      },
      () => {
        // Silent fail keeps UX smooth without blocking interactions.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  private initializeMap(): void {
    if (this.map) {
      return;
    }

    const token = environment.mapbox.accessToken?.trim();
    if (!token) {
      return;
    }

    mapboxgl.accessToken = token;

    this.map = new mapboxgl.Map({
      container: this.mapContainer().nativeElement,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [55.2708, 25.2048],
      zoom: 10,
      attributionControl: false,
      antialias: true,
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
  }

  private renderMarkers(properties: Property[]): void {
    if (!this.map) {
      return;
    }

    this.clearMarkers();

    for (const property of properties) {
      const coordinates = this.extractCoordinates(property.address.mapUrl);
      if (!coordinates) {
        continue;
      }

      const markerElement = document.createElement('div');
      markerElement.className = 'map-price-pill';
      markerElement.textContent = this.formatPricePill(property.price.amount, property.price.currency);
      markerElement.tabIndex = 0;
      markerElement.setAttribute('role', 'button');
      markerElement.setAttribute('aria-label', `View ${property.name.en}`);

      const activateMarker = () => {
        if (!this.map) {
          return;
        }

        this.selectedMarkerEl?.classList.remove('is-active');
        markerElement.classList.add('is-active');
        this.selectedMarkerEl = markerElement;

        this.map.flyTo({
          center: coordinates,
          zoom: Math.max(this.map.getZoom(), 13),
          duration: 900,
          essential: true,
        });

        this.propertySelected.emit(property.id);
      };

      markerElement.addEventListener('click', activateMarker);
      markerElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateMarker();
        }
      });

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat(coordinates)
        .addTo(this.map);

      this.markers.push(marker);
    }

    const first = this.markers[0];
    if (first) {
      this.map.flyTo({ center: first.getLngLat(), zoom: 11, duration: 800, essential: true });
    }
  }

  private clearMarkers(): void {
    for (const marker of this.markers) {
      marker.remove();
    }
    this.markers = [];
    this.selectedMarkerEl = null;
  }

  private extractCoordinates(mapUrl: string): [number, number] | null {
    if (!mapUrl) {
      return null;
    }

    try {
      const url = new URL(mapUrl);
      const patterns = [
        /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        /q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        /ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        /query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      ];

      const combined = `${url.pathname}${url.search}`;
      for (const pattern of patterns) {
        const match = combined.match(pattern);
        if (!match) {
          continue;
        }

        const latitude = Number(match[1]);
        const longitude = Number(match[2]);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return [longitude, latitude];
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private formatPricePill(amount: number, currency: string): string {
    const symbol = currency === 'USD' ? '$' : currency === 'AED' ? 'AED ' : `${currency} `;
    return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
  }
}
