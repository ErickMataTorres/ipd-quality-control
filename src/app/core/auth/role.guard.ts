import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import {
  AppRole,
  UserProfileService,
} from '../user-profile/user-profile.service';

export const roleGuard: CanActivateFn =
  async route => {
    const userProfileService =
      inject(UserProfileService);

    const router = inject(Router);

    const allowedRoles =
      route.data['roles'] as
        | readonly AppRole[]
        | undefined;

    if (!allowedRoles?.length) {
      return true;
    }

    const profile =
      await userProfileService
        .loadCurrentProfile();

    if (!profile) {
      return router.createUrlTree(['/login']);
    }

    if (allowedRoles.includes(profile.role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
