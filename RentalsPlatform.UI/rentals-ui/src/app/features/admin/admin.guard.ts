// admin.guard.ts (النسخة المعدلة)
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (authStore.isAdmin()) {
    return true;
  }
  if (authStore.isAuthenticated()) {
    // Authenticated but not admin → show access-denied
    return router.createUrlTree(['/access-denied']);
  }
  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      return true;
    }
  }

  // No token at all → redirect to login
  return router.createUrlTree(['/auth']);
};