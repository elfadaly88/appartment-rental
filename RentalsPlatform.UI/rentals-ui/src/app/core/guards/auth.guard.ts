import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  authStore.initAuth();

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth']);
};
