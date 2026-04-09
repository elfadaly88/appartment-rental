import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/properties`;

  createProperty(formData: FormData): Observable<HttpEvent<any>> {
    return this.http.post<any>(this.apiUrl, formData, {
      reportProgress: true,
      observe: 'events',
    });
  }
}
