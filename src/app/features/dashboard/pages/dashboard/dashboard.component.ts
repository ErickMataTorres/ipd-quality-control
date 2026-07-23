import {
  DatePipe,
  DecimalPipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';

import {
  RouterLink,
} from '@angular/router';

import {
  Subject,
  debounceTime,
} from 'rxjs';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  MatInputModule,
} from '@angular/material/input';

import {
  MatProgressBarModule,
} from '@angular/material/progress-bar';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import {
  MatSelectModule,
} from '@angular/material/select';

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

import {
  PlantsService,
} from '../../../plants/data-access/plants.service';

import {
  ShiftsService,
} from '../../../shifts/data-access/shifts.service';

import {
  DashboardService,
  DashboardTopDefect,
  DashboardTrendPoint,
} from '../../data-access/dashboard.service';

function formatLocalDate(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getLocalDate(): string {
  return formatLocalDate(new Date());
}

function parseLocalDate(
  value: string,
): Date {
  const [
    year,
    month,
    day,
  ] = value
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
  );
}

function subtractDays(
  value: string,
  days: number,
): string {
  const date =
    parseLocalDate(value);

  date.setDate(
    date.getDate() - days,
  );

  return formatLocalDate(date);
}

@Component({
  selector: 'app-dashboard',

  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],

  templateUrl:
    './dashboard.component.html',

  styleUrl:
    './dashboard.component.scss',
})
export class DashboardComponent
  implements OnInit, OnDestroy {
  private readonly snackBar =
    inject(MatSnackBar);

  readonly userProfileService =
    inject(UserProfileService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly dashboardService =
    inject(DashboardService);

  readonly selectedPlantId =
    signal('');

  readonly selectedShiftId =
    signal('all');

  readonly selectedDate =
    signal(getLocalDate());

  private readonly realtimeReload =
    new Subject<void>();

  private fallbackTimer:
    ReturnType<typeof setInterval>
    | null = null;

  readonly isLoading = computed(
    () =>
      this.dashboardService.isLoading()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly selectedDateLabel =
    computed(() => {
      const value =
        this.selectedDate();

      return new Intl.DateTimeFormat(
        'es-MX',
        {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        },
      ).format(
        parseLocalDate(value),
      );
    });

  readonly trendMaxIpd = computed(
    () =>
      Math.max(
        1,
        ...this.dashboardService
          .trend()
          .map(
            point =>
              point.ipdPercentage ?? 0,
          ),
      ),
  );

  readonly topDefectMax = computed(
    () =>
      Math.max(
        1,
        ...this.dashboardService
          .topDefects()
          .map(
            defect =>
              defect.quantity,
          ),
      ),
  );

  readonly reportedRatioLabel = computed(
    () => {
      const summary =
        this.dashboardService.summary();

      if (!summary) {
        return '0 de 0';
      }

      return `${summary.reportedCombinations} de ${summary.totalCombinations}`;
    },
  );

  readonly realtimeLabel = computed(
    () => {
      switch (
        this.dashboardService
          .realtimeStatus()
      ) {
        case 'connected':
          return 'Datos en tiempo real';

        case 'connecting':
          return 'Conectando...';

        case 'error':
          return 'Actualización periódica';

        default:
          return 'Actualización periódica';
      }
    },
  );

  constructor() {
    this.realtimeReload
      .pipe(
        debounceTime(600),
      )
      .subscribe(() => {
        void this.loadDashboard(true);
      });
  }

  ngOnInit(): void {
    void this.initialize();

    this.dashboardService
      .subscribeToRecordChanges(
        () =>
          this.realtimeReload.next(),
      );

    this.fallbackTimer =
      setInterval(
        () => {
          void this.loadDashboard(true);
        },
        60000,
      );
  }

  ngOnDestroy(): void {
    this.dashboardService
      .unsubscribeFromRecordChanges();

    this.realtimeReload.complete();

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  handleFilterChange(): void {
    void this.loadDashboard();
  }

  async reload(): Promise<void> {
    await this.loadDashboard(true);
  }

  trendBarHeight(
    point: DashboardTrendPoint,
  ): number {
    if (
      point.ipdPercentage === null
      || point.ipdPercentage <= 0
    ) {
      return 3;
    }

    return Math.max(
      8,
      (
        point.ipdPercentage
        / this.trendMaxIpd()
      ) * 100,
    );
  }

  defectBarWidth(
    defect: DashboardTopDefect,
  ): number {
    return Math.max(
      4,
      (
        defect.quantity
        / this.topDefectMax()
      ) * 100,
    );
  }

  private async initialize():
    Promise<void> {
    try {
      await Promise.all([
        this.plantsService.loadPlants(),
        this.shiftsService.loadShifts(),
      ]);

      const profile =
        this.userProfileService.profile()
        ?? await this.userProfileService
          .loadCurrentProfile();

      const activePlants =
        this.plantsService
          .plants()
          .filter(
            plant => plant.active,
          );

      const selectedPlant =
        activePlants.find(
          plant =>
            plant.id
            === profile?.defaultPlantId,
        )
        ?? activePlants[0];

      this.selectedPlantId.set(
        selectedPlant?.id ?? '',
      );

      await this.loadDashboard();
    } catch (error: unknown) {
      console.error(
        'Unable to initialize dashboard.',
        error,
      );

      this.snackBar.open(
        'No fue posible preparar el panel principal.',
        'Cerrar',
        {
          duration: 5000,
        },
      );
    }
  }

  private async loadDashboard(
    silent = false,
  ): Promise<void> {
    const productionDate =
      this.selectedDate();

    await this.dashboardService
      .loadDashboard(
        {
          plantId:
            this.selectedPlantId(),

          productionDate,

          dateFrom:
            subtractDays(
              productionDate,
              13,
            ),

          dateTo:
            productionDate,

          shiftId:
            this.selectedShiftId()
              === 'all'
              ? null
              : this.selectedShiftId(),
        },
        silent,
      );
  }
}
