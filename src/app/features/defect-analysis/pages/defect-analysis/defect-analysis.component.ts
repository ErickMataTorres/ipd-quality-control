import {
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
  DefectAnalysisQuery,
  DefectAnalysisService,
  DefectByLineItem,
  DefectParetoItem,
  DefectTrendPoint,
} from '../../data-access/defect-analysis.service';

type DatePreset =
  | 'current_month'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'custom';

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

function todayValue(): string {
  return formatLocalDate(new Date());
}

function currentMonthStart(): string {
  const date =
    new Date();

  return formatLocalDate(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
      12,
    ),
  );
}

function subtractDays(
  days: number,
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() - days,
  );

  return formatLocalDate(date);
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
    'app-defect-analysis',

  imports: [
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
    './defect-analysis.component.html',

  styleUrl:
    './defect-analysis.component.scss',
})
export class DefectAnalysisComponent
  implements OnInit, OnDestroy {
  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly analysisService =
    inject(DefectAnalysisService);

  readonly selectedPlantId =
    signal('');

  readonly selectedShiftId =
    signal('all');

  readonly selectedLineId =
    signal('all');

  readonly selectedDefectTypeId =
    signal('all');

  readonly selectedPreset =
    signal<DatePreset>('current_month');

  readonly dateFrom =
    signal(currentMonthStart());

  readonly dateTo =
    signal(todayValue());

  readonly occurrenceSearch =
    signal('');

  private readonly realtimeReload =
    new Subject<void>();

  private fallbackTimer:
    ReturnType<typeof setInterval>
    | null = null;

  readonly isLoading = computed(
    () =>
      this.analysisService.isLoading()
      || this.analysisService
        .isLoadingOptions()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly paretoMaximum = computed(
    () =>
      Math.max(
        1,
        ...this.analysisService
          .pareto()
          .map(
            item => item.quantity,
          ),
      ),
  );

  readonly trendMaximum = computed(
    () =>
      Math.max(
        1,
        ...this.analysisService
          .trend()
          .map(
            item =>
              item.defectIpdPercentage
              ?? 0,
          ),
      ),
  );

  readonly lineMaximum = computed(
    () =>
      Math.max(
        1,
        ...this.analysisService
          .byLine()
          .map(
            item => item.totalDefects,
          ),
      ),
  );

  readonly paretoLinePoints = computed(
    () => {
      const items =
        this.analysisService.pareto();

      if (items.length === 0) {
        return '';
      }

      if (items.length === 1) {
        return `50,${
          100
          - items[0].cumulativePercentage
        }`;
      }

      return items
        .map(
          (item, index) => {
            const x =
              (
                index
                / (items.length - 1)
              ) * 100;

            const y =
              100
              - item.cumulativePercentage;

            return `${x},${y}`;
          },
        )
        .join(' ');
    },
  );

  readonly filteredOccurrences =
    computed(() => {
      const search =
        this.occurrenceSearch()
          .trim()
          .toLocaleLowerCase('es');

      if (!search) {
        return this.analysisService
          .occurrences();
      }

      return this.analysisService
        .occurrences()
        .filter(item =>
          [
            item.productionLineName,
            item.productModelName,
            item.shiftCode,
            item.supervisorName,
            item.supervisorEmployeeNumber,
            item.defectTypeName,
            item.defectTypeCode,
            item.defectComment ?? '',
            item.recordComment ?? '',
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(search),
        );
    });

  readonly periodLabel = computed(
    () => {
      const formatter =
        new Intl.DateTimeFormat(
          'es-MX',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          },
        );

      return `${
        formatter.format(
          parseLocalDate(
            this.dateFrom(),
          ),
        )
      } – ${
        formatter.format(
          parseLocalDate(
            this.dateTo(),
          ),
        )
      }`;
    },
  );

  readonly realtimeLabel = computed(
    () => {
      switch (
        this.analysisService
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
        void this.loadAnalysis(true);
      });
  }

  ngOnInit(): void {
    void this.initialize();

    this.analysisService
      .subscribeToChanges(
        () =>
          this.realtimeReload.next(),
      );

    this.fallbackTimer =
      setInterval(
        () => {
          void this.loadAnalysis(true);
        },
        60000,
      );
  }

  ngOnDestroy(): void {
    this.analysisService
      .unsubscribeFromChanges();

    this.realtimeReload.complete();

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  async handlePlantChange(
    plantId: string,
  ): Promise<void> {
    this.selectedPlantId.set(plantId);
    this.selectedLineId.set('all');

    await this.analysisService
      .loadFilterOptions(plantId);

    await this.loadAnalysis();
  }

  handleFilterChange(): void {
    void this.loadAnalysis();
  }

  applyPreset(
    preset: DatePreset,
  ): void {
    this.selectedPreset.set(preset);

    switch (preset) {
      case 'current_month':
        this.dateFrom.set(
          currentMonthStart(),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_7':
        this.dateFrom.set(
          subtractDays(6),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_30':
        this.dateFrom.set(
          subtractDays(29),
        );
        this.dateTo.set(todayValue());
        break;

      case 'last_90':
        this.dateFrom.set(
          subtractDays(89),
        );
        this.dateTo.set(todayValue());
        break;

      case 'custom':
        return;
    }

    void this.loadAnalysis();
  }

  handleDateChange(
    target:
      | 'from'
      | 'to',
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    if (target === 'from') {
      this.dateFrom.set(input.value);
    } else {
      this.dateTo.set(input.value);
    }

    this.selectedPreset.set('custom');

    void this.loadAnalysis();
  }

  updateOccurrenceSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.occurrenceSearch.set(
      input.value,
    );
  }

  clearOccurrenceSearch(): void {
    this.occurrenceSearch.set('');
  }

  async reload(): Promise<void> {
    await this.loadAnalysis(true);
  }

  paretoBarHeight(
    item: DefectParetoItem,
  ): number {
    return Math.max(
      5,
      (
        item.quantity
        / this.paretoMaximum()
      ) * 100,
    );
  }

  trendBarHeight(
    item: DefectTrendPoint,
  ): number {
    if (
      item.defectIpdPercentage === null
      || item.defectIpdPercentage <= 0
    ) {
      return 3;
    }

    return Math.max(
      6,
      (
        item.defectIpdPercentage
        / this.trendMaximum()
      ) * 100,
    );
  }

  lineBarWidth(
    item: DefectByLineItem,
  ): number {
    return Math.max(
      3,
      (
        item.totalDefects
        / this.lineMaximum()
      ) * 100,
    );
  }

  formatDate(
    value: string,
  ): string {
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

      await this.analysisService
        .loadFilterOptions(
          this.selectedPlantId(),
        );

      await this.loadAnalysis();
    } catch (error: unknown) {
      console.error(
        'Unable to initialize defect analysis.',
        error,
      );

      this.snackBar.open(
        'No fue posible preparar el módulo de análisis de defectos.',
        'Cerrar',
        {
          duration: 5000,
        },
      );
    }
  }

  private async loadAnalysis(
    silent = false,
  ): Promise<void> {
    if (
      !this.dateFrom()
      || !this.dateTo()
    ) {
      return;
    }

    if (
      this.dateFrom()
      > this.dateTo()
    ) {
      this.snackBar.open(
        'La fecha inicial no puede ser posterior a la fecha final.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return;
    }

    await this.analysisService
      .loadAnalysis(
        this.currentQuery(),
        silent,
      );
  }

  private currentQuery():
    DefectAnalysisQuery {
    return {
      plantId:
        this.selectedPlantId(),

      dateFrom:
        this.dateFrom(),

      dateTo:
        this.dateTo(),

      shiftId:
        this.selectedShiftId()
          === 'all'
          ? null
          : this.selectedShiftId(),

      lineModelAssignmentId:
        this.selectedLineId()
          === 'all'
          ? null
          : this.selectedLineId(),

      defectTypeId:
        this.selectedDefectTypeId()
          === 'all'
          ? null
          : this.selectedDefectTypeId(),
    };
  }
}
