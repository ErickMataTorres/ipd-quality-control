import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
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
  PlantFormDialogComponent,
  PlantFormDialogData,
} from '../../components/plant-form-dialog/plant-form-dialog.component';

import {
  Plant,
  PlantInput,
  PlantsService,
} from '../../data-access/plants.service';

@Component({
  selector: 'app-plants-list',
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
  templateUrl: './plants-list.component.html',
  styleUrl: './plants-list.component.scss',
})
export class PlantsListComponent
  implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly plantsService =
    inject(PlantsService);

  readonly searchTerm = signal('');
  readonly isSaving = signal(false);

  readonly displayedColumns = [
    'code',
    'name',
    'timezone',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredPlants = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    if (!search) {
      return this.plantsService.plants();
    }

    return this.plantsService
      .plants()
      .filter(plant =>
        [
          plant.code,
          plant.name,
          plant.timezone,
          plant.description ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search),
      );
  });

  readonly totalPlants = computed(
    () => this.plantsService.plants().length,
  );

  readonly activePlants = computed(
    () =>
      this.plantsService
        .plants()
        .filter(plant => plant.active)
        .length,
  );

  readonly inactivePlants = computed(
    () =>
      this.plantsService
        .plants()
        .filter(plant => !plant.active)
        .length,
  );

  ngOnInit(): void {
    void this.plantsService.loadPlants();
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
      await this.openPlantDialog(null);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.plantsService.createPlant(
        result,
      );

      this.snackBar.open(
        'La planta fue agregada correctamente.',
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
    plant: Plant,
  ): Promise<void> {
    const result =
      await this.openPlantDialog(plant);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.plantsService.updatePlant(
        plant.id,
        result,
      );

      this.snackBar.open(
        'Los datos de la planta fueron actualizados.',
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

  async togglePlantStatus(
    plant: Plant,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.plantsService.setPlantActive(
        plant.id,
        !plant.active,
      );

      this.snackBar.open(
        plant.active
          ? 'La planta fue desactivada.'
          : 'La planta fue activada.',
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
    await this.plantsService.loadPlants();
  }

  private async openPlantDialog(
    plant: Plant | null,
  ): Promise<PlantInput | undefined> {
    const dialogReference =
      this.dialog.open<
        PlantFormDialogComponent,
        PlantFormDialogData,
        PlantInput
      >(
        PlantFormDialogComponent,
        {
          width: '680px',
          maxWidth: 'calc(100vw - 32px)',
          disableClose: true,
          autoFocus: 'first-tabbable',
          data: {
            plant,
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
      'Plant operation failed.',
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
        'Ya existe una planta con el mismo código o nombre.';
    }

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos para realizar esta operación.';
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
