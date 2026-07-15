import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly authService = inject(AuthService);

  private readonly router = inject(Router);

  readonly isSigningOut = signal(false);

  readonly employeeNumber = computed(
    () =>
      this.authService
        .user()
        ?.email
        ?.split('@')[0] ?? '',
  );

  async signOut(): Promise<void> {
    this.isSigningOut.set(true);

    try {
      await this.authService.signOut();
      await this.router.navigate(['/login']);
    } finally {
      this.isSigningOut.set(false);
    }
  }
}
