import { DatePipe } from '@angular/common';

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
  SupervisorAssignmentFormDialogComponent,
  SupervisorAssignmentFormDialogData,
  SupervisorAssignmentFormDialogResult,
} from '../../components/supervisor-assignment-form-dialog/supervisor-assignment-form-dialog.component';

import {
  SupervisorAssignment,
  SupervisorAssignmentsService,
} from '../../data-access/supervisor-assignments.service';

type AssignmentFilter =
  | 'all'
  | 'current'
  | 'scheduled'
  | 'history'
  | 'inactive';

function getLocalDate(): string {
  const currentDate = new Date();

  const year = currentDate.getFullYear();

  const month = String(
    currentDate.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    currentDate.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

@Component({
  selector:
    'app-supervisor-assignments-list',

  imports: [
    DatePipe,
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
    './supervisor-assignments-list.component.html',

  styleUrl:
    './supervisor-assignments-list.component.scss',
})
export class SupervisorAssignmentsListComponent
  implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly assignmentsService =
    inject(SupervisorAssignmentsService);

  readonly plantsService =
    inject(PlantsService);

  readonly linesService =
    inject(ProductionLinesService);

  readonly shiftsService =
    inject(ShiftsService);

  readonly searchTerm = signal('');
  readonly selectedPlantId = signal('all');

  readonly selectedFilter =
    signal<AssignmentFilter>('current');

  readonly isSaving = signal(false);

  readonly canManage = computed(() => {
    const role =
      this.userProfileService.role();

    return role === 'system_administrator'
      || role === 'quality_manager';
  });

  readonly isLoading = computed(
    () =>
      this.assignmentsService.isLoading()
      || this.plantsService.isLoading()
      || this.linesService.isLoading()
      || this.shiftsService.isLoading(),
  );

  readonly displayedColumns = [
    'supervisor',
    'plant',
    'line',
    'model',
    'shift',
    'period',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredAssignments = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    const plantId =
      this.selectedPlantId();

    const filter =
      this.selectedFilter();

    const today = getLocalDate();

    return this.assignmentsService
      .assignments()
      .filter(assignment => {
        if (
          plantId !== 'all'
          && assignment.plantId !== plantId
        ) {
          return false;
        }

        if (
          filter === 'current'
          && !assignment.isCurrent
        ) {
          return false;
        }

        if (
          filter === 'scheduled'
          && (
            !assignment.active
            || assignment.effectiveFrom <= today
          )
        ) {
          return false;
        }

        if (
          filter === 'history'
          && (
            !assignment.active
            || !assignment.effectiveTo
            || assignment.effectiveTo >= today
          )
        ) {
          return false;
        }

        if (
          filter === 'inactive'
          && assignment.active
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          assignment.supervisorName,
          assignment.employeeNumber,
          assignment.plantCode,
          assignment.plantName,
          assignment.productionLineName,
          assignment.productModelName,
          assignment.modelYear?.toString() ?? '',
          assignment.shiftCode,
          assignment.shiftName,
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search);
      });
  });

  readonly totalAssignments = computed(
    () =>
      this.assignmentsService
        .assignments()
        .length,
  );

  readonly currentAssignments = computed(
    () =>
      this.assignmentsService
        .assignments()
        .filter(
          assignment =>
            assignment.isCurrent,
        )
        .length,
  );

  readonly assignedSupervisors = computed(
    () =>
      new Set(
        this.assignmentsService
          .assignments()
          .filter(
            assignment =>
              assignment.isCurrent,
          )
          .map(
            assignment =>
              assignment.supervisorEmployeeId,
          ),
      ).size,
  );

  readonly assignedLines = computed(
    () =>
      new Set(
        this.assignmentsService
          .assignments()
          .filter(
            assignment =>
              assignment.isCurrent,
          )
          .map(
            assignment =>
              assignment.productionLineId,
          ),
      ).size,
  );

  ngOnInit(): void {
    void this.initialize();
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

  updateSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  async openCreateDialog(): Promise<void> {
    const result =
      await this.openAssignmentDialog(null);

    if (
      !result
      || result.mode !== 'create'
    ) {
      return;
    }

    this.isSaving.set(true);

    try {
      const createdCount =
        await this.assignmentsService
          .createAssignments(result.value);

      this.snackBar.open(
        createdCount === 1
          ? 'La asignación fue creada correctamente.'
          : `Se crearon ${createdCount} asignaciones correctamente.`,
        'Cerrar',
        {
          duration: 4500,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async openEditDialog(
    assignment: SupervisorAssignment,
  ): Promise<void> {
    const result =
      await this.openAssignmentDialog(
        assignment,
      );

    if (
      !result
      || result.mode !== 'update'
    ) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.assignmentsService
        .updateAssignment(result.value);

      this.snackBar.open(
        'La asignación fue actualizada correctamente.',
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

  async toggleAssignmentStatus(
    assignment: SupervisorAssignment,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.assignmentsService
        .updateAssignment({
          assignmentId:
            assignment.id,

          shiftId:
            assignment.shiftId,

          effectiveFrom:
            assignment.effectiveFrom,

          effectiveTo:
            assignment.effectiveTo,

          active:
            !assignment.active,
        });

      this.snackBar.open(
        assignment.active
          ? 'La asignación fue desactivada.'
          : 'La asignación fue activada.',
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
      this.assignmentsService
        .loadAssignments(),

      this.plantsService
        .loadPlants(),

      this.linesService
        .loadLines(),

      this.shiftsService
        .loadShifts(),
    ]);
  }

  private async openAssignmentDialog(
    assignment: SupervisorAssignment | null,
  ): Promise<
    SupervisorAssignmentFormDialogResult
    | undefined
  > {
    const activePlants =
      this.plantsService
        .plants()
        .filter(plant => plant.active);

    const selectedPlant =
      this.selectedPlantId();

    const defaultPlantId =
      selectedPlant !== 'all'
        ? selectedPlant
        : activePlants[0]?.id ?? null;

    const dialogReference =
      this.dialog.open<
        SupervisorAssignmentFormDialogComponent,
        SupervisorAssignmentFormDialogData,
        SupervisorAssignmentFormDialogResult
      >(
        SupervisorAssignmentFormDialogComponent,
        {
          width: '770px',
          maxWidth: 'calc(100vw - 24px)',
          disableClose: true,
          autoFocus: 'first-tabbable',

          data: {
            assignment,

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
      'Supervisor assignment operation failed.',
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
        'La asignación se superpone con otro periodo existente para el mismo supervisor, línea y turno.';
    }

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos o alguno de los datos seleccionados pertenece a otra planta.';
    }

    if (databaseError.code === '22023') {
      message =
        'Los datos de la asignación no son válidos.';
    }

    if (databaseError.code === 'P0002') {
      message =
        'La asignación ya no existe.';
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
