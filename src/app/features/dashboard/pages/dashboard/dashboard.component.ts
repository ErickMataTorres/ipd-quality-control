import {
  Component,
  inject,
} from '@angular/core';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

@Component({
  selector: 'app-dashboard',
  imports: [MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly userProfileService =
    inject(UserProfileService);
}
