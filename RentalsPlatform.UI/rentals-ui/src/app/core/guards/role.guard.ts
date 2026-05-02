import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    authStore.initAuth();

    const user = authStore.currentUser();
    if (!user) {
      return router.createUrlTree(['/auth']);
    }

    const normalizedAllowed = allowedRoles.map((r) => r.trim().toLowerCase());
    const currentRole = user.role.trim().toLowerCase();

    if (normalizedAllowed.includes(currentRole)) {
      return true;
    }

    // User is authenticated but doesn't have the required role
    return router.createUrlTree(['/access-denied']);
  };
};
