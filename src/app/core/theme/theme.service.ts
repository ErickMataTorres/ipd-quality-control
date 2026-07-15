import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  ThemePreference,
} from '../user-profile/user-profile.service';

export type ResolvedTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly systemThemeQuery =
    window.matchMedia(
      '(prefers-color-scheme: dark)',
    );

  readonly preference =
    signal<ThemePreference>('system');

  readonly resolvedTheme =
    signal<ResolvedTheme>('light');

  constructor() {
    this.applyTheme();

    this.systemThemeQuery.addEventListener(
      'change',
      () => {
        if (this.preference() === 'system') {
          this.applyTheme();
        }
      },
    );
  }

  initialize(
    preference: ThemePreference,
  ): void {
    this.preference.set(preference);
    this.applyTheme();
  }

  setPreference(
    preference: ThemePreference,
  ): void {
    this.preference.set(preference);
    this.applyTheme();
  }

  private applyTheme(): void {
    const preference = this.preference();

    const resolvedTheme: ResolvedTheme =
      preference === 'system'
        ? this.systemThemeQuery.matches
          ? 'dark'
          : 'light'
        : preference;

    this.resolvedTheme.set(resolvedTheme);

    const htmlElement =
      this.document.documentElement;

    htmlElement.dataset['theme'] =
      resolvedTheme;

    htmlElement.style.colorScheme =
      resolvedTheme;
  }
}
