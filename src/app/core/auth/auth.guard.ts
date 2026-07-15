import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (
  _route,
  state,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const session = await authService.getSession();

    if (session) {
      return true;
    }
  } catch {
    // The user will be redirected to the login page.
  }

  return router.createUrlTree(
    ['/login'],
    {
      queryParams: {
        returnUrl: state.url,
      },
    },
  );
};

export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const session = await authService.getSession();

    if (session) {
      return router.createUrlTree(['/dashboard']);
    }
  } catch {
    // The login page remains available.
  }

  return true;
};
