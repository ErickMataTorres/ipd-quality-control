import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly userProfileService =
    inject(UserProfileService);

  readonly isSigningOut = signal(false);

  ngOnInit(): void {
    void this.userProfileService.loadCurrentProfile();
  }

  async reloadProfile(): Promise<void> {
    await this.userProfileService.loadCurrentProfile(
      true,
    );
  }

  async signOut(): Promise<void> {
    this.isSigningOut.set(true);

    try {
      this.userProfileService.clear();
      await this.authService.signOut();
      await this.router.navigate(['/login']);
    } finally {
      this.isSigningOut.set(false);
    }
  }
}
