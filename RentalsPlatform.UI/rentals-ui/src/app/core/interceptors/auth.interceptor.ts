import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  // SSR-safe token access. Never touch localStorage on the Node SSR server.
  const token = isBrowser
    ? localStorage.getItem('jwtToken') ?? localStorage.getItem('token')
    : null;

  let authReq = req;
  const isAssetRequest = req.url.includes('/assets/');
  
  if (token && !req.headers.has('Authorization') && !isAssetRequest) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isBrowser) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('token');
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    }),
  );
};
