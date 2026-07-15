import {
  Component,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-feature-placeholder',
  imports: [MatIconModule],
  templateUrl: './feature-placeholder.component.html',
  styleUrl: './feature-placeholder.component.scss',
})
export class FeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title =
    this.route.snapshot.data['pageTitle'] as string;

  readonly description =
    this.route.snapshot.data['description'] as string;

  readonly icon =
    this.route.snapshot.data['icon'] as string;
}
