import {
  DatePipe,
  DecimalPipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import { MatSelectModule } from '@angular/material/select';

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import { MatTableModule } from '@angular/material/table';

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
  ProductionLinesService,
} from '../../../production-lines/data-access/production-lines.service';

import {
  ShiftsService,
} from '../../../shifts/data-access/shifts.service';

import {
  IpdTargetFormDialogComponent,
  IpdTargetFormDialogData,
} from '../../components/ipd-target-form-dialog/ipd-target-form-dialog.component';

import {
  IpdTarget,
  IpdTargetInput,
  IpdTargetsService,
} from '../../data-access/ipd-targets.service';

type TargetFilter =
  | 'all'
  | 'current'
  | 'general'
  | 'shift'
  | 'scheduled'
  | 'history'
  | 'inactive';

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
  selector: 'app-ipd-targets-list',

  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],

  templateUrl:
    './ipd-targets-list.component.html',

  styleUrl:
    './ipd-targets-list.component.scss',
})
export class IpdTargetsListComponent
  implements OnInit {
  private readonly dialog =
    inject(MatDialog);

  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly targetsService =
    inject(IpdTargetsService);

  readonly plantsService =
    inject(PlantsService);

  readonly linesService =
    inject(ProductionLinesService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly searchTerm = signal('');
  readonly selectedPlantId = signal('all');

  readonly selectedFilter =
    signal<TargetFilter>('current');

  readonly isSaving = signal(false);

  readonly canManage = computed(() => {
    const role =
      this.userProfileService.role();

    return role === 'system_administrator'
      || role === 'quality_manager';
  });

  readonly isLoading = computed(
    () =>
      this.targetsService.isLoading()
      || this.plantsService.isLoading()
      || this.linesService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly displayedColumns = [
    'plant',
    'line',
    'model',
    'scope',
    'target',
    'period',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredTargets = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    const plantId =
      this.selectedPlantId();

    const filter =
      this.selectedFilter();

    const today = getLocalDate();

    return this.targetsService
      .targets()
      .filter(target => {
        if (
          plantId !== 'all'
          && target.plantId !== plantId
        ) {
          return false;
        }

        if (
          filter === 'current'
          && !target.isCurrent
        ) {
          return false;
        }

        if (
          filter === 'general'
          && !target.isGeneralTarget
        ) {
          return false;
        }

        if (
          filter === 'shift'
          && target.isGeneralTarget
        ) {
          return false;
        }

        if (
          filter === 'scheduled'
          && (
            !target.active
            || target.effectiveFrom <= today
          )
        ) {
          return false;
        }

        if (
          filter === 'history'
          && (
            !target.active
            || !target.effectiveTo
            || target.effectiveTo >= today
          )
        ) {
          return false;
        }

        if (
          filter === 'inactive'
          && target.active
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          target.plantCode,
          target.plantName,
          target.productionLineName,
          target.productModelName,
          target.modelYear?.toString() ?? '',
          target.shiftCode ?? 'general',
          target.shiftName ?? 'objetivo general',
          target.targetPercentage.toString(),
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search);
      });
  });

  readonly totalTargets = computed(
    () =>
      this.targetsService.targets().length,
  );

  readonly currentTargets = computed(
    () =>
      this.targetsService
        .targets()
        .filter(target => target.isCurrent)
        .length,
  );

  readonly currentGeneralTargets = computed(
    () =>
      this.targetsService
        .targets()
        .filter(
          target =>
            target.isCurrent
            && target.isGeneralTarget,
        )
        .length,
  );

  readonly currentShiftTargets = computed(
    () =>
      this.targetsService
        .targets()
        .filter(
          target =>
            target.isCurrent
            && !target.isGeneralTarget,
        )
        .length,
  );

  ngOnInit(): void {
    void this.initialize();
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

  async openCreateDialog(): Promise<void> {
    const result =
      await this.openTargetDialog(null);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.targetsService
        .saveTarget(result);

      this.snackBar.open(
        'El objetivo IPD fue agregado correctamente.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async openEditDialog(
    target: IpdTarget,
  ): Promise<void> {
    const result =
      await this.openTargetDialog(target);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.targetsService
        .saveTarget(result);

      this.snackBar.open(
        'El objetivo IPD fue actualizado correctamente.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleTargetStatus(
    target: IpdTarget,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.targetsService.saveTarget({
        targetId:
          target.id,

        lineModelAssignmentId:
          target.lineModelAssignmentId,

        shiftId:
          target.shiftId,

        targetPercentage:
          target.targetPercentage,

        effectiveFrom:
          target.effectiveFrom,

        effectiveTo:
          target.effectiveTo,

        active:
          !target.active,
      });

      this.snackBar.open(
        target.active
          ? 'El objetivo IPD fue desactivado.'
          : 'El objetivo IPD fue activado.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async reload(): Promise<void> {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    await Promise.all([
      this.targetsService.loadTargets(),
      this.plantsService.loadPlants(),
      this.linesService.loadLines(),
      this.shiftsService.loadShifts(),
    ]);
  }

  private async openTargetDialog(
    target: IpdTarget | null,
  ): Promise<IpdTargetInput | undefined> {
    const activePlants =
      this.plantsService
        .plants()
        .filter(plant => plant.active);

    const selectedPlant =
      this.selectedPlantId();

    const defaultPlantId =
      target?.plantId
      ?? (
        selectedPlant !== 'all'
          ? selectedPlant
          : activePlants[0]?.id ?? null
      );

    const dialogReference =
      this.dialog.open<
        IpdTargetFormDialogComponent,
        IpdTargetFormDialogData,
        IpdTargetInput
      >(
        IpdTargetFormDialogComponent,
        {
          width: '750px',
          maxWidth: 'calc(100vw - 24px)',
          disableClose: true,
          autoFocus: 'first-tabbable',

          data: {
            target,

            plants:
              this.plantsService.plants(),

            lines:
              this.linesService.lines(),

            shifts:
              this.shiftsService.shifts(),

            defaultPlantId,
          },
        },
      );

    return firstValueFrom(
      dialogReference.afterClosed(),
    );
  }

  private showDatabaseError(
    error: unknown,
  ): void {
    console.error(
      'IPD target operation failed.',
      error,
    );

    const databaseError =
      error as {
        code?: string;
        message?: string;
      };

    let message =
      'No fue posible completar la operación.';

    if (databaseError.code === '23P01') {
      message =
        'El objetivo se superpone con otro periodo activo para la misma línea, modelo y alcance.';
    }

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos o el objetivo pertenece a una planta fuera de tu acceso.';
    }

    if (databaseError.code === '22023') {
      message =
        'Los datos del objetivo IPD no son válidos.';
    }

    if (databaseError.code === 'P0002') {
      message =
        'El objetivo IPD ya no existe.';
    }

    this.snackBar.open(
      message,
      'Cerrar',
      {
        duration: 5500,
      },
    );
  }
}
