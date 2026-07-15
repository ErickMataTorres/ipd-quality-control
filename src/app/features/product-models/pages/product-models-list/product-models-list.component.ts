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
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

import {
  ProductModelFormDialogComponent,
  ProductModelFormDialogData,
} from '../../components/product-model-form-dialog/product-model-form-dialog.component';

import {
  ProductModel,
  ProductModelInput,
  ProductModelsService,
} from '../../data-access/product-models.service';

@Component({
  selector: 'app-product-models-list',
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
    './product-models-list.component.html',
  styleUrl:
    './product-models-list.component.scss',
})
export class ProductModelsListComponent
  implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly productModelsService =
    inject(ProductModelsService);

  readonly searchTerm = signal('');
  readonly isSaving = signal(false);

  readonly canManage = computed(
    () =>
      this.userProfileService.role()
      === 'system_administrator',
  );

  readonly displayedColumns = [
    'name',
    'modelYear',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredModels = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    if (!search) {
      return this.productModelsService.models();
    }

    return this.productModelsService
      .models()
      .filter(model =>
        [
          model.name,
          model.model_year?.toString() ?? '',
          model.description ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search),
      );
  });

  readonly totalModels = computed(
    () => this.productModelsService.models().length,
  );

  readonly activeModels = computed(
    () =>
      this.productModelsService
        .models()
        .filter(model => model.active)
        .length,
  );

  readonly inactiveModels = computed(
    () =>
      this.productModelsService
        .models()
        .filter(model => !model.active)
        .length,
  );

  ngOnInit(): void {
    void this.productModelsService.loadModels();
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
      await this.openModelDialog(null);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.productModelsService.createModel(
        result,
      );

      this.snackBar.open(
        'El modelo fue agregado correctamente.',
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
    model: ProductModel,
  ): Promise<void> {
    const result =
      await this.openModelDialog(model);

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.productModelsService.updateModel(
        model.id,
        result,
      );

      this.snackBar.open(
        'El modelo fue actualizado correctamente.',
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

  async toggleModelStatus(
    model: ProductModel,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.productModelsService.setModelActive(
        model.id,
        !model.active,
      );

      this.snackBar.open(
        model.active
          ? 'El modelo fue desactivado.'
          : 'El modelo fue activado.',
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
    await this.productModelsService.loadModels();
  }

  private async openModelDialog(
    model: ProductModel | null,
  ): Promise<ProductModelInput | undefined> {
    const dialogReference =
      this.dialog.open<
        ProductModelFormDialogComponent,
        ProductModelFormDialogData,
        ProductModelInput
      >(
        ProductModelFormDialogComponent,
        {
          width: '610px',
          maxWidth: 'calc(100vw - 32px)',
          disableClose: true,
          autoFocus: 'first-tabbable',
          data: {
            model,
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
      'Product model operation failed.',
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
        'Ya existe un modelo con el mismo nombre.';
    }

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos para realizar esta operación.';
    }

    if (databaseError.code === '23514') {
      message =
        'El año del modelo no es válido.';
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
