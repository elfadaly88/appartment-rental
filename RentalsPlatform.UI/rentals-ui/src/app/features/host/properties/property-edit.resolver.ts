import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { HostPropertyDetails, PropertyService } from '../services/property.service';

export const propertyEditResolver: ResolveFn<HostPropertyDetails | null> = (route) => {
  const propertyService = inject(PropertyService);
  const router = inject(Router);
  const propertyId = route.paramMap.get('id');

  if (!propertyId) {
    void router.navigate(['/host/dashboard']);
    return of(null);
  }

  return propertyService.getProperty(propertyId).pipe(
    catchError((err: unknown) => {
      // 403 = property exists but this host doesn't own it (URL tampering attempt)
      if (err instanceof HttpErrorResponse && err.status === 403) {
        void router.navigate(['/access-denied']);
      } else {
        // 404, 5xx, network errors → quietly back to dashboard
        void router.navigate(['/host/dashboard']);
      }
      return of(null);
    }),
  );
};
