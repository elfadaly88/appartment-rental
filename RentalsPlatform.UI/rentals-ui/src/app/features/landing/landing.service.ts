import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LandingStats } from './landing-stats.model';
import { environment } from '../../../environments/environment';

export interface FeaturedProperty {
  id: string;
  title: string;
  city: string;
  country: string;
  pricePerNight: number;
  currency: string;
  thumbnailUrl: string | null;
  maxGuests: number;
}

export interface FeaturedPropertiesResult {
  items: FeaturedProperty[];
  totalCount: number;
  page: number;
  pageSize: number;
  availableCities: string[];
}

@Injectable({ providedIn: 'root' })
export class LandingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getLandingStats(): Observable<LandingStats> {
    return this.http.get<LandingStats>(`${this.baseUrl}/public/landing-stats`);
  }

  getFeaturedProperties(city?: string, page = 1, pageSize = 12): Observable<FeaturedPropertiesResult> {
    let url = `${this.baseUrl}/public/properties?page=${page}&pageSize=${pageSize}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    return this.http.get<FeaturedPropertiesResult>(url);
  }
}
