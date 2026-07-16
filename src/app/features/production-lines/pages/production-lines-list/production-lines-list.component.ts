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
  ProductModelsService,
} from '../../../product-models/data-access/product-models.service';

import {
  ProductionLineFormDialogComponent,
  ProductionLineFormDialogData,
} from '../../components/production-line-form-dialog/production-line-form-dialog.component';

import {
  ProductionLine,
  ProductionLineInput,
  ProductionLinesService,
} from '../../data-access/production-lines.service';

@Component({
  selector: 'app-production-lines-list',
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
    './production-lines-list.component.html',
  styleUrl:
    './production-lines-list.component.scss',
})
export class ProductionLinesListComponent
  implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly productionLinesService =
    inject(ProductionLinesService);

  readonly plantsService =
    inject(PlantsService);

  readonly productModelsService =
    inject(ProductModelsService);

  readonly searchTerm = signal('');
  readonly selectedPlantId = signal('all');
  readonly isSaving = signal(false);

  readonly canManage = computed(() => {
    const role =
      this.userProfileService.role();

    return role === 'system_administrator'
      || role === 'quality_manager';
  });

  readonly isLoading = computed(
    () =>
      this.productionLinesService.isLoading()
      || this.plantsService.isLoading()
      || this.productModelsService.isLoading(),
  );

  readonly displayedColumns = [
    'order',
    'line',
    'plant',
    'model',
    'effectiveFrom',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredLines = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    const plantId =
      this.selectedPlantId();

    return this.productionLinesService
      .lines()
      .filter(line => {
        const matchesPlant =
          plantId === 'all'
          || line.plant_id === plantId;

        if (!matchesPlant) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          line.name,
          line.description ?? '',
          line.plant_code,
          line.plant_name,
          line.product_model_name ?? '',
          line.model_year?.toString() ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search);
      });
  });

  readonly totalLines = computed(
    () =>
      this.productionLinesService
        .lines()
        .length,
  );

  readonly activeLines = computed(
    () =>
      this.productionLinesService
        .lines()
        .filter(line => line.active)
        .length,
  );

  readonly inactiveLines = computed(
    () =>
      this.productionLinesService
        .lines()
        .filter(line => !line.active)
        .length,
  );

  readonly linesWithoutModel = computed(
    () =>
      this.productionLinesService
        .lines()
        .filter(
          line => !line.product_model_id,
        )
        .length,
  );

  ngOnInit(): void {
    void this.initialize();
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
      await this.openLineDialog(null);

    if (!result) {
      return;
    }

    await this.saveLine(
      result,
      'La línea fue agregada correctamente.',
    );
  }

  async openEditDialog(
    line: ProductionLine,
  ): Promise<void> {
    const result =
      await this.openLineDialog(line);

    if (!result) {
      return;
    }

    await this.saveLine(
      result,
      'La línea fue actualizada correctamente.',
    );
  }

  async toggleLineStatus(
    line: ProductionLine,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.productionLinesService
        .setLineActive(
          line.id,
          !line.active,
        );

      this.snackBar.open(
        line.active
          ? 'La línea fue desactivada.'
          : 'La línea fue activada.',
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
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    await Promise.all([
      this.productionLinesService.loadLines(),
      this.plantsService.loadPlants(),
      this.productModelsService.loadModels(),
    ]);
  }

  private async saveLine(
    input: ProductionLineInput,
    successMessage: string,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.productionLinesService
        .saveLine(input);

      this.snackBar.open(
        successMessage,
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

  private async openLineDialog(
    line: ProductionLine | null,
  ): Promise<ProductionLineInput | undefined> {
    if (
      this.plantsService.plants().length === 0
    ) {
      this.snackBar.open(
        'Primero debes registrar una planta.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return undefined;
    }

    if (
      this.productModelsService.models().length === 0
    ) {
      this.snackBar.open(
        'Primero debes registrar un modelo.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return undefined;
    }

    const dialogReference =
      this.dialog.open<
        ProductionLineFormDialogComponent,
        ProductionLineFormDialogData,
        ProductionLineInput
      >(
        ProductionLineFormDialogComponent,
        {
          width: '730px',
          maxWidth: 'calc(100vw - 32px)',
          disableClose: true,
          autoFocus: 'first-tabbable',
          data: {
            line,
            plants:
              this.plantsService.plants(),
            models:
              this.productModelsService.models(),
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
      'Production line operation failed.',
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
        'Ya existe una línea con el mismo nombre dentro de la planta.';
    }

    if (databaseError.code === '23P01') {
      message =
        'La vigencia seleccionada se superpone con otra asignación de modelo.';
    }

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos para realizar esta operación.';
    }

    if (databaseError.code === '22023') {
      message =
        'Los datos ingresados no son válidos.';
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
