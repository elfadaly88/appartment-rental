import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CityDto {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface GovernorateDto {
  id: string;
  nameAr: string;
  nameEn: string;
  cities: CityDto[];
}

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);

  getEgyptLocations(): Observable<GovernorateDto[]> {
    return this.http.get<GovernorateDto[]>(`${environment.apiUrl}/lookups/egypt-locations`);
  }
}
