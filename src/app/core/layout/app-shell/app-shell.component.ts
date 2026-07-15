import {
  BreakpointObserver,
} from '@angular/cdk/layout';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import { filter } from 'rxjs';

import {
  AuthService,
} from '../../auth/auth.service';

import {
  ThemeService,
} from '../../theme/theme.service';

import {
  AppRole,
  ThemePreference,
  UserProfileService,
} from '../../user-profile/user-profile.service';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles?: readonly AppRole[];
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const MANAGEMENT_ROLES:
  readonly AppRole[] = [
    'system_administrator',
    'quality_manager',
  ];

const CAPTURE_ROLES:
  readonly AppRole[] = [
    'system_administrator',
    'quality_manager',
    'quality_supervisor',
  ];

const ADMIN_ROLES:
  readonly AppRole[] = [
    'system_administrator',
  ];

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent
  implements OnInit {
  private readonly breakpointObserver =
    inject(BreakpointObserver);

  private readonly activatedRoute =
    inject(ActivatedRoute);

  private readonly router = inject(Router);
  private readonly authService =
    inject(AuthService);

  private readonly snackBar =
    inject(MatSnackBar);

  readonly userProfileService =
    inject(UserProfileService);

  readonly themeService =
    inject(ThemeService);

  readonly isMobile = signal(false);
  readonly sidebarOpened = signal(true);
  readonly pageTitle =
    signal('Panel principal');
  readonly isSigningOut = signal(false);

  private readonly navigationGroups:
    NavigationGroup[] = [
      {
        label: 'Operación',
        items: [
          {
            label: 'Panel principal',
            icon: 'dashboard',
            route: '/dashboard',
          },
          {
            label: 'Operación en tiempo real',
            icon: 'monitoring',
            route: '/live-operations',
          },
          {
            label: 'Registros diarios',
            icon: 'edit_note',
            route: '/daily-entries',
            roles: CAPTURE_ROLES,
          },
          {
            label: 'Rendimiento por línea',
            icon: 'query_stats',
            route: '/line-performance',
          },
          {
            label: 'Análisis de defectos',
            icon: 'bug_report',
            route: '/defect-analysis',
          },
          {
            label: 'Reportes',
            icon: 'summarize',
            route: '/reports',
          },
        ],
      },
      {
        label: 'Administración operativa',
        items: [
          {
            label: 'Empleados',
            icon: 'groups',
            route: '/employees',
            roles: MANAGEMENT_ROLES,
          },
          {
            label: 'Asignaciones',
            icon: 'assignment_ind',
            route: '/supervisor-assignments',
            roles: MANAGEMENT_ROLES,
          },
          {
            label: 'Objetivos IPD',
            icon: 'track_changes',
            route: '/ipd-targets',
            roles: MANAGEMENT_ROLES,
          },
        ],
      },
      {
        label: 'Catálogos',
        items: [
          {
            label: 'Plantas',
            icon: 'factory',
            route: '/plants',
            roles: ADMIN_ROLES,
          },
          {
            label: 'Líneas',
            icon: 'schema',
            route: '/production-lines',
            roles: MANAGEMENT_ROLES,
          },
          {
            label: 'Modelos',
            icon: 'directions_car',
            route: '/product-models',
            roles: MANAGEMENT_ROLES,
          },
          {
            label: 'Turnos',
            icon: 'schedule',
            route: '/shifts',
            roles: ADMIN_ROLES,
          },
          {
            label: 'Tipos de defecto',
            icon: 'rule',
            route: '/defect-types',
            roles: MANAGEMENT_ROLES,
          },
        ],
      },
      {
        label: 'Sistema',
        items: [
          {
            label: 'Usuarios',
            icon: 'manage_accounts',
            route: '/user-management',
            roles: ADMIN_ROLES,
          },
          {
            label: 'Historial de cambios',
            icon: 'history',
            route: '/audit-log',
            roles: ADMIN_ROLES,
          },
        ],
      },
    ];

  readonly visibleNavigationGroups =
    computed(() => {
      const role =
        this.userProfileService.role();

      if (!role) {
        return [];
      }

      return this.navigationGroups
        .map(group => ({
          ...group,
          items: group.items.filter(
            item =>
              !item.roles
              || item.roles.includes(role),
          ),
        }))
        .filter(group => group.items.length > 0);
    });

  readonly themeLabel = computed(() => {
    const labels:
      Record<ThemePreference, string> = {
        system: 'Tema del sistema',
        light: 'Tema claro',
        dark: 'Tema oscuro',
      };

    return labels[
      this.themeService.preference()
    ];
  });

  constructor() {
    this.breakpointObserver
      .observe('(max-width: 959px)')
      .pipe(takeUntilDestroyed())
      .subscribe(result => {
        this.isMobile.set(result.matches);
        this.sidebarOpened.set(
          !result.matches,
        );
      });

    this.router.events
      .pipe(
        filter(
          (
            event,
          ): event is NavigationEnd =>
            event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.updatePageTitle();
      });
  }

  async ngOnInit(): Promise<void> {
    const profile =
      await this.userProfileService
        .loadCurrentProfile();

    if (profile) {
      this.themeService.initialize(
        profile.preferredTheme,
      );
    }

    this.updatePageTitle();
  }

  toggleSidebar(): void {
    this.sidebarOpened.update(
      currentValue => !currentValue,
    );
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile()) {
      this.sidebarOpened.set(false);
    }
  }

  async changeTheme(
    preference: ThemePreference,
  ): Promise<void> {
    const previousPreference =
      this.themeService.preference();

    this.themeService.setPreference(
      preference,
    );

    try {
      await this.userProfileService
        .updatePreferences(preference);
    } catch (error: unknown) {
      console.error(
        'Unable to save theme preference.',
        error,
      );

      this.themeService.setPreference(
        previousPreference,
      );

      this.snackBar.open(
        'No fue posible guardar la preferencia del tema.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    }
  }

  async signOut(): Promise<void> {
    if (this.isSigningOut()) {
      return;
    }

    this.isSigningOut.set(true);

    try {
      this.userProfileService.clear();

      await this.authService.signOut();

      await this.router.navigate(['/login']);
    } finally {
      this.isSigningOut.set(false);
    }
  }

  private updatePageTitle(): void {
    let currentRoute: ActivatedRoute =
      this.activatedRoute;

    while (currentRoute.firstChild) {
      currentRoute =
        currentRoute.firstChild;
    }

    const title =
      currentRoute.snapshot.data[
        'pageTitle'
      ] as string | undefined;

    this.pageTitle.set(
      title ?? 'Panel principal',
    );
  }
}
