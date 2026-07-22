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
  firstValueFrom,
  Subject,
} from 'rxjs';

import {
  debounceTime,
} from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import { MatSelectModule } from '@angular/material/select';

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  PlantsService,
} from '../../../plants/data-access/plants.service';

import {
  ShiftsService,
} from '../../../shifts/data-access/shifts.service';

import {
  DailyIpdRecordDialogComponent,
  DailyIpdRecordDialogData,
  DailyIpdRecordDialogResult,
} from '../../components/daily-ipd-record-dialog/daily-ipd-record-dialog.component';

import {
  AssignedSupervisor,
  DailyEntriesService,
  DailyOperationBoardItem,
} from '../../data-access/daily-entries.service';

function getLocalDate(): string {
  const currentDate = new Date();

  const year =
    currentDate.getFullYear();

  const month = String(
    currentDate.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    currentDate.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-daily-entries-list',

  imports: [
    DecimalPipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],

  templateUrl:
    './daily-entries-list.component.html',

  styleUrl:
    './daily-entries-list.component.scss',
})
export class DailyEntriesListComponent
  implements OnInit, OnDestroy {
  private readonly dialog =
    inject(MatDialog);

  private readonly snackBar =
    inject(MatSnackBar);

  readonly entriesService =
    inject(DailyEntriesService);

  readonly plantsService =
    inject(PlantsService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly selectedPlantId =
    signal('');

  readonly selectedShiftId =
    signal('');

  readonly selectedDate =
    signal(getLocalDate());

  readonly searchTerm =
    signal('');

  readonly realtimeReload =
    new Subject<void>();

  readonly isLoading = computed(
    () =>
      this.entriesService.isLoading()
      || this.plantsService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly filteredBoard = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    if (!search) {
      return this.entriesService.board();
    }

    return this.entriesService
      .board()
      .filter(item =>
        [
          item.productionLineName,
          item.productModelName,
          item.modelYear?.toString() ?? '',
          item.shiftCode,
          item.supervisorName ?? '',
          ...item.assignedSupervisors.map(
            supervisor =>
              supervisor.fullName,
          ),
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search),
      );
  });

  readonly completedLines = computed(
    () =>
      this.entriesService
        .board()
        .filter(
          item =>
            item.status === 'submitted'
            || item.status === 'closed'
            || item.status
              === 'no_production',
        )
        .length,
  );

  readonly pendingLines = computed(
    () =>
      this.entriesService
        .board()
        .filter(
          item =>
            item.recordId === null
            || item.status === 'draft',
        )
        .length,
  );

  readonly totalProduced = computed(
    () =>
      this.entriesService
        .board()
        .reduce(
          (
            total,
            item,
          ) =>
            total
            + (
              item.producedQuantity
              ?? 0
            ),
          0,
        ),
  );

  readonly totalDefects = computed(
    () =>
      this.entriesService
        .board()
        .reduce(
          (
            total,
            item,
          ) =>
            total
            + (
              item.totalDefects
              ?? 0
            ),
          0,
        ),
  );

  readonly dailyIpd = computed(() => {
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
  });

  constructor() {
    this.realtimeReload
      .pipe(
        debounceTime(500),
      )
      .subscribe(() => {
        void this.loadBoard();
      });
  }

  ngOnInit(): void {
    void this.initialize();

    this.entriesService
      .subscribeToRecordChanges(
        () =>
          this.realtimeReload.next(),
      );
  }

  ngOnDestroy(): void {
    this.entriesService
      .unsubscribeFromRecordChanges();

    this.realtimeReload.complete();
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
    void this.loadBoard();
  }

  async openRecordDialog(
    item: DailyOperationBoardItem,
  ): Promise<void> {
    if (
      !item.recordId
      && item.assignedSupervisors.length
        === 0
    ) {
      this.snackBar.open(
        'Asigna primero un supervisor a esta línea y turno.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return;
    }

    if (item.status === 'closed') {
      this.snackBar.open(
        'El registro está cerrado y ya no puede modificarse desde esta pantalla.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return;
    }

    const dialogReference =
      this.dialog.open<
        DailyIpdRecordDialogComponent,
        DailyIpdRecordDialogData,
        DailyIpdRecordDialogResult
      >(
        DailyIpdRecordDialogComponent,
        {
          width: '960px',
          maxWidth: 'calc(100vw - 16px)',
          disableClose: true,
          autoFocus: false,

          data: {
            item,

            productionDate:
              this.selectedDate(),

            defectTypes:
              this.entriesService
                .defectTypes(),
          },
        },
      );

    const result =
      await firstValueFrom(
        dialogReference.afterClosed(),
      );

    if (result?.saved) {
      await this.loadBoard();

      this.snackBar.open(
        'El registro diario fue guardado correctamente.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    }
  }

  async reload(): Promise<void> {
    await this.loadBoard();
  }

  primaryAssignedSupervisor(
    item: DailyOperationBoardItem,
  ): AssignedSupervisor | null {
    return item.assignedSupervisors[0]
      ?? null;
  }

  effectiveTarget(
    item: DailyOperationBoardItem,
  ): number | null {
    return item.recordId
      ? item.recordTargetPercentage
      : item.targetPercentage;
  }

  statusLabel(
    item: DailyOperationBoardItem,
  ): string {
    if (!item.recordId) {
      return 'Pendiente';
    }

    switch (item.status) {
      case 'draft':
        return 'Borrador';

      case 'submitted':
        return 'Enviado';

      case 'closed':
        return 'Cerrado';

      case 'no_production':
        return 'Sin producción';

      default:
        return 'Pendiente';
    }
  }

  statusIcon(
    item: DailyOperationBoardItem,
  ): string {
    if (!item.recordId) {
      return 'schedule';
    }

    switch (item.status) {
      case 'draft':
        return 'edit_note';

      case 'submitted':
        return 'send';

      case 'closed':
        return 'lock';

      case 'no_production':
        return 'block';

      default:
        return 'schedule';
    }
  }

  initials(
    fullName: string,
  ): string {
    return fullName
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0).toUpperCase(),
      )
      .join('');
  }

  private async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.plantsService.loadPlants(),
        this.shiftsService.loadShifts(),
        this.entriesService.loadDefectTypes(),
      ]);

      const activePlant =
        this.plantsService
          .plants()
          .find(plant => plant.active);

      const activeShift =
        this.shiftsService
          .shifts()
          .find(shift => shift.active);

      this.selectedPlantId.set(
        activePlant?.id ?? '',
      );

      this.selectedShiftId.set(
        activeShift?.id ?? '',
      );

      await this.loadBoard();
    } catch (error: unknown) {
      console.error(
        'Unable to initialize daily entries.',
        error,
      );

      this.snackBar.open(
        'No fue posible cargar los catálogos necesarios.',
        'Cerrar',
        {
          duration: 5000,
        },
      );
    }
  }

  private async loadBoard(): Promise<void> {
    await this.entriesService.loadBoard(
      this.selectedPlantId(),
      this.selectedShiftId(),
      this.selectedDate(),
    );
  }
}
