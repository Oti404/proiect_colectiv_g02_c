import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DemoAuthService } from '../services/demo-auth.service';

export const demoGuestGuard: CanActivateFn = () => {
  const auth = inject(DemoAuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/search']) : true;
};
