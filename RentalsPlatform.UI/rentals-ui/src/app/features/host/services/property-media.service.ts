import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PropertyMediaService {
  private readonly http = inject(HttpClient);
  private readonly mediaUrl = `${environment.apiUrl}/host/properties`;

  uploadImages(propertyId: string, files: File[]): Observable<HttpEvent<unknown>> {
    const formData = new FormData();

    for (const file of files) {
      formData.append('files', file, file.name);
    }

    return this.http.post<unknown>(
      `${this.mediaUrl}/${encodeURIComponent(propertyId)}/images`,
      formData,
      {
        reportProgress: true,
        observe: 'events',
      },
    );
  }
}
