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
  LinePerformanceDaily,
  LinePerformanceDefect,
  LinePerformanceOverview,
  LinePerformanceService,
} from '../../data-access/line-performance.service';

type PerformanceStatusFilter =
  | 'all'
  | 'within'
  | 'outside'
  | 'without_data';

function currentMonthValue(): string {
  const date =
    new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
  ].join('-');
}

function moveMonth(
  value: string,
  offset: number,
): string {
  const [
    year,
    month,
  ] = value
    .split('-')
    .map(Number);

  const date =
    new Date(
      year,
      month - 1 + offset,
      1,
      12,
    );

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
  ].join('-');
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
  );
}

@Component({
  selector:
    'app-line-performance',

  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],

  templateUrl:
    './line-performance.component.html',

  styleUrl:
    './line-performance.component.scss',
})
export class LinePerformanceComponent
  implements OnInit, OnDestroy {
  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly performanceService =
    inject(LinePerformanceService);

  readonly selectedPlantId =
    signal('');

  readonly selectedShiftId =
    signal('all');

  readonly selectedMonth =
    signal(currentMonthValue());

  readonly selectedStatus =
    signal<PerformanceStatusFilter>(
      'all',
    );

  readonly searchTerm =
    signal('');

  readonly selectedLineId =
    signal('');

  private readonly realtimeReload =
    new Subject<void>();

  private fallbackTimer:
    ReturnType<typeof setInterval>
    | null = null;

  readonly isLoading = computed(
    () =>
      this.performanceService.isLoading()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly filteredOverview = computed(
    () => {
      const search =
        this.searchTerm()
          .trim()
          .toLocaleLowerCase('es');

      const status =
        this.selectedStatus();

      return this.performanceService
        .overview()
        .filter(line => {
          if (
            status === 'within'
            && line.isWithinTarget !== true
          ) {
            return false;
          }

          if (
            status === 'outside'
            && line.isWithinTarget !== false
          ) {
            return false;
          }

          if (
            status === 'without_data'
            && line.reportedRecords > 0
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          return [
            line.productionLineName,
            line.productModelName,
            line.modelYear?.toString() ?? '',
            line.plantCode,
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(search);
        });
    },
  );

  readonly selectedLine = computed(
    () =>
      this.performanceService
        .overview()
        .find(
          line =>
            line.lineModelAssignmentId
            === this.selectedLineId(),
        )
      ?? null,
  );

  readonly monthLabel = computed(
    () => {
      const [
        year,
        month,
      ] = this.selectedMonth()
        .split('-')
        .map(Number);

      return new Intl.DateTimeFormat(
        'es-MX',
        {
          month: 'long',
          year: 'numeric',
        },
      ).format(
        new Date(
          year,
          month - 1,
          1,
          12,
        ),
      );
    },
  );

  readonly canGoNext = computed(
    () =>
      this.selectedMonth()
      < currentMonthValue(),
  );

  readonly totalProduced = computed(
    () =>
      this.performanceService
        .overview()
        .reduce(
          (
            total,
            line,
          ) =>
            total
            + line.producedQuantity,
          0,
        ),
  );

  readonly totalDefects = computed(
    () =>
      this.performanceService
        .overview()
        .reduce(
          (
            total,
            line,
          ) =>
            total
            + line.totalDefects,
          0,
        ),
  );

  readonly aggregateIpd = computed(
    () => {
      const produced =
        this.totalProduced();

      if (produced <= 0) {
        return null;
      }

      return Number(
        (
          (
            this.totalDefects()
            / produced
          ) * 100
        ).toFixed(4),
      );
    },
  );

  readonly linesWithData = computed(
    () =>
      this.performanceService
        .overview()
        .filter(
          line =>
            line.reportedRecords > 0,
        )
        .length,
  );

  readonly linesWithinTarget = computed(
    () =>
      this.performanceService
        .overview()
        .filter(
          line =>
            line.isWithinTarget === true,
        )
        .length,
  );

  readonly linesOutsideTarget = computed(
    () =>
      this.performanceService
        .overview()
        .filter(
          line =>
            line.isWithinTarget === false,
        )
        .length,
  );

  readonly dailyMaxIpd = computed(
    () =>
      Math.max(
        1,
        ...this.performanceService
          .daily()
          .map(
            day =>
              Math.max(
                day.ipdPercentage ?? 0,
                day.targetPercentage ?? 0,
              ),
          ),
      ),
  );

  readonly defectMax = computed(
    () =>
      Math.max(
        1,
        ...this.performanceService
          .defects()
          .map(
            defect =>
              defect.quantity,
          ),
      ),
  );

  readonly realtimeLabel = computed(
    () => {
      switch (
        this.performanceService
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
        void this.reloadAll(true);
      });
  }

  ngOnInit(): void {
    void this.initialize();

    this.performanceService
      .subscribeToRecordChanges(
        () =>
          this.realtimeReload.next(),
      );

    this.fallbackTimer =
      setInterval(
        () => {
          void this.reloadAll(true);
        },
        60000,
      );
  }

  ngOnDestroy(): void {
    this.performanceService
      .unsubscribeFromRecordChanges();

    this.realtimeReload.complete();

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  updateSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  handleFilterChange(): void {
    void this.reloadAll();
  }

  previousMonth(): void {
    this.selectedMonth.set(
      moveMonth(
        this.selectedMonth(),
        -1,
      ),
    );

    void this.reloadAll();
  }

  nextMonth(): void {
    if (!this.canGoNext()) {
      return;
    }

    this.selectedMonth.set(
      moveMonth(
        this.selectedMonth(),
        1,
      ),
    );

    void this.reloadAll();
  }

  selectLine(
    line: LinePerformanceOverview,
  ): void {
    if (
      this.selectedLineId()
      === line.lineModelAssignmentId
    ) {
      return;
    }

    this.selectedLineId.set(
      line.lineModelAssignmentId,
    );

    void this.loadSelectedDetails();
  }

  async reload(): Promise<void> {
    await this.reloadAll(true);
  }

  dailyBarHeight(
    day: LinePerformanceDaily,
  ): number {
    if (
      day.ipdPercentage === null
      || day.ipdPercentage <= 0
    ) {
      return 3;
    }

    return Math.max(
      7,
      (
        day.ipdPercentage
        / this.dailyMaxIpd()
      ) * 100,
    );
  }

  dailyTargetHeight(
    day: LinePerformanceDaily,
  ): number {
    if (
      day.targetPercentage === null
      || day.targetPercentage <= 0
    ) {
      return 0;
    }

    return Math.min(
      100,
      (
        day.targetPercentage
        / this.dailyMaxIpd()
      ) * 100,
    );
  }

  defectBarWidth(
    defect: LinePerformanceDefect,
  ): number {
    return Math.max(
      4,
      (
        defect.quantity
        / this.defectMax()
      ) * 100,
    );
  }

  formatShortDate(
    value: string | null,
  ): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat(
      'es-MX',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    ).format(
      parseLocalDate(value),
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

      await this.reloadAll();
    } catch (error: unknown) {
      console.error(
        'Unable to initialize line performance.',
        error,
      );

      this.snackBar.open(
        'No fue posible preparar el módulo de rendimiento.',
        'Cerrar',
        {
          duration: 5000,
        },
      );
    }
  }

  private async reloadAll(
    silent = false,
  ): Promise<void> {
    const previousSelectedLineId =
      this.selectedLineId();

    await this.performanceService
      .loadOverview(
        this.currentQuery(),
        silent,
      );

    const overview =
      this.performanceService.overview();

    const selectedLine =
      overview.find(
        line =>
          line.lineModelAssignmentId
          === previousSelectedLineId,
      )
      ?? overview[0];

    this.selectedLineId.set(
      selectedLine
        ?.lineModelAssignmentId
      ?? '',
    );

    await this.loadSelectedDetails(silent);
  }

  private async loadSelectedDetails(
    silent = false,
  ): Promise<void> {
    const lineId =
      this.selectedLineId();

    if (!lineId) {
      this.performanceService
        .clearDetails();

      return;
    }

    await this.performanceService
      .loadDetails(
        lineId,
        this.currentQuery(),
        silent,
      );
  }

  private currentQuery() {
    return {
      plantId:
        this.selectedPlantId(),

      month:
        this.selectedMonth(),

      shiftId:
        this.selectedShiftId()
          === 'all'
          ? null
          : this.selectedShiftId(),
    };
  }
}
