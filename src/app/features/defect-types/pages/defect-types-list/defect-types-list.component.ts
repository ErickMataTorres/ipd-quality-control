import {
  DatePipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  firstValueFrom,
} from 'rxjs';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatChipsModule,
} from '@angular/material/chips';

import {
  MatDialog,
} from '@angular/material/dialog';

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
  MatMenuModule,
} from '@angular/material/menu';

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
  MatTableModule,
} from '@angular/material/table';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

import {
  DefectTypeFormDialogComponent,
  DefectTypeFormDialogData,
} from '../../components/defect-type-form-dialog/defect-type-form-dialog.component';

import {
  DefectType,
  DefectTypeInput,
  DefectTypesService,
} from '../../data-access/defect-types.service';

type StatusFilter =
  | 'all'
  | 'active'
  | 'inactive';

@Component({
  selector:
    'app-defect-types-list',

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
    './defect-types-list.component.html',

  styleUrl:
    './defect-types-list.component.scss',
})
export class DefectTypesListComponent
  implements OnInit {
  private readonly dialog =
    inject(MatDialog);

  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly defectTypesService =
    inject(DefectTypesService);

  readonly searchTerm =
    signal('');

  readonly selectedCategory =
    signal('all');

  readonly selectedStatus =
    signal<StatusFilter>('all');

  readonly isSaving =
    signal(false);

  readonly canManage = computed(
    () => {
      const role =
        this.userProfileService.role();

      return (
        role === 'system_administrator'
        || role === 'quality_manager'
      );
    },
  );

  readonly displayedColumns = [
    'order',
    'code',
    'name',
    'category',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly categories = computed(
    () =>
      Array.from(
        new Set(
          this.defectTypesService
            .defectTypes()
            .map(
              defectType =>
                defectType.category
                  ?.trim(),
            )
            .filter(
              (
                category,
              ): category is string =>
                Boolean(category),
            ),
        ),
      ).sort(
        (left, right) =>
          left.localeCompare(
            right,
            'es',
            {
              sensitivity: 'base',
            },
          ),
      ),
  );

  readonly filteredDefectTypes =
    computed(() => {
      const search =
        this.searchTerm()
          .trim()
          .toLocaleLowerCase('es');

      const selectedCategory =
        this.selectedCategory();

      const selectedStatus =
        this.selectedStatus();

      return this.defectTypesService
        .defectTypes()
        .filter(defectType => {
          if (
            selectedCategory !== 'all'
            && defectType.category
              !== selectedCategory
          ) {
            return false;
          }

          if (
            selectedStatus === 'active'
            && !defectType.active
          ) {
            return false;
          }

          if (
            selectedStatus === 'inactive'
            && defectType.active
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          return [
            defectType.code,
            defectType.name_es,
            defectType.name_en,
            defectType.category ?? '',
            defectType.description ?? '',
            defectType.display_order
              .toString(),
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(search);
        });
    });

  readonly totalDefectTypes =
    computed(
      () =>
        this.defectTypesService
          .defectTypes()
          .length,
    );

  readonly activeDefectTypes =
    computed(
      () =>
        this.defectTypesService
          .defectTypes()
          .filter(
            defectType =>
              defectType.active,
          )
          .length,
    );

  readonly inactiveDefectTypes =
    computed(
      () =>
        this.defectTypesService
          .defectTypes()
          .filter(
            defectType =>
              !defectType.active,
          )
          .length,
    );

  readonly categoryCount =
    computed(
      () =>
        this.categories().length,
    );

  ngOnInit(): void {
    void this.defectTypesService
      .loadDefectTypes();
  }

  updateSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(
      input.value,
    );
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('all');
    this.selectedStatus.set('all');
  }

  async openCreateDialog():
    Promise<void> {
    const result =
      await this.openDefectTypeDialog(
        null,
      );

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.defectTypesService
        .createDefectType(result);

      this.snackBar.open(
        'El tipo de defecto fue agregado correctamente.',
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
    defectType: DefectType,
  ): Promise<void> {
    const result =
      await this.openDefectTypeDialog(
        defectType,
      );

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.defectTypesService
        .updateDefectType(
          defectType.id,
          result,
        );

      this.snackBar.open(
        'El tipo de defecto fue actualizado correctamente.',
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

  async toggleDefectTypeStatus(
    defectType: DefectType,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.defectTypesService
        .setDefectTypeActive(
          defectType.id,
          !defectType.active,
        );

      this.snackBar.open(
        defectType.active
          ? 'El tipo de defecto fue desactivado.'
          : 'El tipo de defecto fue activado.',
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
    await this.defectTypesService
      .loadDefectTypes();
  }

  private async openDefectTypeDialog(
    defectType: DefectType | null,
  ): Promise<
    DefectTypeInput | undefined
  > {
    const dialogReference =
      this.dialog.open<
        DefectTypeFormDialogComponent,
        DefectTypeFormDialogData,
        DefectTypeInput
      >(
        DefectTypeFormDialogComponent,
        {
          width: '700px',
          maxWidth:
            'calc(100vw - 32px)',

          disableClose: true,
          autoFocus:
            'first-tabbable',

          data: {
            defectType,
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
      'Defect type operation failed.',
      error,
    );

    const databaseError =
      error as {
        code?: string;
        message?: string;
      };

    let message =
      'No fue posible completar la operación.';

    if (
      databaseError.code === '23505'
    ) {
      message =
        'Ya existe un tipo de defecto con el mismo código o nombre en español.';
    }

    if (
      databaseError.code === '42501'
    ) {
      message =
        'No tienes permisos para realizar esta operación.';
    }

    if (
      databaseError.code === '23514'
    ) {
      message =
        'Los datos del tipo de defecto no cumplen con las validaciones.';
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
