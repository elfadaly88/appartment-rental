import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

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
    catchError(() => {
      void router.navigate(['/host/dashboard']);
      return of(null);
    }),
  );
};
