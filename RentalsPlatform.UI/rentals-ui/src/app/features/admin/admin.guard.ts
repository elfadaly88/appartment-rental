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
     return router.createUrlTree(['/properties']);
  }
  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      return true;
    }
  }

  // 4. لو مفيش توكن خالص، ارجع لصفحة اللوج إن
  return router.createUrlTree(['/auth']);
};