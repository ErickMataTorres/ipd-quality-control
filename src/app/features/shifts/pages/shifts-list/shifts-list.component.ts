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

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import { MatTableModule } from '@angular/material/table';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  ShiftFormDialogComponent,
  ShiftFormDialogData,
} from '../../components/shift-form-dialog/shift-form-dialog.component';

import {
  Shift,
  ShiftInput,
  ShiftsService,
} from '../../data-access/shifts.service';

@Component({
  selector: 'app-shifts-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl:
    './shifts-list.component.html',
  styleUrl:
    './shifts-list.component.scss',
})
export class ShiftsListComponent
  implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly shiftsService =
    inject(ShiftsService);

  readonly searchTerm = signal('');
  readonly isSaving = signal(false);

  readonly displayedColumns = [
    'order',
    'code',
    'name',
    'schedule',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredShifts = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    if (!search) {
      return this.shiftsService.shifts();
    }

    return this.shiftsService
      .shifts()
      .filter(shift =>
        [
          shift.code,
          shift.name,
          this.formatSchedule(shift),
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search),
      );
  });

  readonly totalShifts = computed(
    () => this.shiftsService.shifts().length,
  );

  readonly activeShifts = computed(
    () =>
      this.shiftsService
        .shifts()
        .filter(shift => shift.active)
        .length,
  );

  readonly inactiveShifts = computed(
    () =>
      this.shiftsService
        .shifts()
        .filter(shift => !shift.active)
        .length,
  );

  ngOnInit(): void {
    void this.shiftsService.loadShifts();
  }

  updateSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  formatSchedule(shift: Shift): string {
    const startTime =
      this.formatTime(shift.start_time);

    const endTime =
      this.formatTime(shift.end_time);

    if (startTime && endTime) {
      return `${startTime} — ${endTime}`;
    }

    if (startTime) {
      return `Desde ${startTime}`;
    }

    if (endTime) {
      return `Hasta ${endTime}`;
    }

    return 'Sin horario definido';
  }

  async openCreateDialog(): Promise<void> {
    const result =
      await this.openShiftDialog(null);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.shiftsService.createShift(
        result,
      );

      this.snackBar.open(
        'El turno fue agregado correctamente.',
        'Cerrar',
        {
          duration: 3500,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async openEditDialog(
    shift: Shift,
  ): Promise<void> {
    const result =
      await this.openShiftDialog(shift);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.shiftsService.updateShift(
        shift.id,
        result,
      );

      this.snackBar.open(
        'El turno fue actualizado correctamente.',
        'Cerrar',
        {
          duration: 3500,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleShiftStatus(
    shift: Shift,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.shiftsService.setShiftActive(
        shift.id,
        !shift.active,
      );

      this.snackBar.open(
        shift.active
          ? 'El turno fue desactivado.'
          : 'El turno fue activado.',
        'Cerrar',
        {
          duration: 3500,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async reload(): Promise<void> {
    await this.shiftsService.loadShifts();
  }

  private formatTime(
    time: string | null,
  ): string {
    return time?.slice(0, 5) ?? '';
  }

  private async openShiftDialog(
    shift: Shift | null,
  ): Promise<ShiftInput | undefined> {
    const dialogReference =
      this.dialog.open<
        ShiftFormDialogComponent,
        ShiftFormDialogData,
        ShiftInput
      >(
        ShiftFormDialogComponent,
        {
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          disableClose: true,
          autoFocus: 'first-tabbable',
          data: {
            shift,
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
      'Shift operation failed.',
      error,
    );

    const databaseError =
      error as {
        code?: string;
        message?: string;
      };

    let message =
      'No fue posible completar la operación.';

    if (databaseError.code === '23505') {
      message =
        'Ya existe un turno con el mismo código o nombre.';
    }

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos para realizar esta operación.';
    }

    if (databaseError.code === '23514') {
      message =
        'El orden o alguno de los datos del turno no es válido.';
    }

    this.snackBar.open(
      message,
      'Cerrar',
      {
        duration: 5000,
      },
    );
  }
}
