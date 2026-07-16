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
  PlantsService,
} from '../../../plants/data-access/plants.service';

import {
  SourceLocationMappingFormDialogComponent,
  SourceLocationMappingFormDialogData,
} from '../../components/source-location-mapping-form-dialog/source-location-mapping-form-dialog.component';

import {
  SourceLocationMapping,
  SourceLocationMappingInput,
  SourceLocationMappingsService,
} from '../../data-access/source-location-mappings.service';

type MappingFilter =
  | 'all'
  | 'mapped'
  | 'unmapped'
  | 'inactive';

@Component({
  selector:
    'app-source-location-mappings-list',

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
    './source-location-mappings-list.component.html',

  styleUrl:
    './source-location-mappings-list.component.scss',
})
export class SourceLocationMappingsListComponent
  implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly mappingsService =
    inject(SourceLocationMappingsService);

  readonly plantsService =
    inject(PlantsService);

  readonly searchTerm = signal('');

  readonly selectedFilter =
    signal<MappingFilter>('all');

  readonly isSaving = signal(false);

  readonly displayedColumns = [
    'sourceCode',
    'displayName',
    'plant',
    'employees',
    'status',
    'updatedAt',
    'actions',
  ];

  readonly filteredMappings = computed(() => {
    const search =
      this.searchTerm()
        .trim()
        .toLocaleLowerCase('es');

    const filter =
      this.selectedFilter();

    return this.mappingsService
      .mappings()
      .filter(mapping => {
        if (
          filter === 'mapped'
          && (
            !mapping.active
            || !mapping.plantId
          )
        ) {
          return false;
        }

        if (
          filter === 'unmapped'
          && (
            !mapping.active
            || mapping.plantId
          )
        ) {
          return false;
        }

        if (
          filter === 'inactive'
          && mapping.active
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        return [
          mapping.sourceCode,
          mapping.displayName ?? '',
          mapping.plantCode ?? '',
          mapping.plantName ?? '',
          mapping.notes ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(search);
      });
  });

  readonly totalMappings = computed(
    () =>
      this.mappingsService.mappings().length,
  );

  readonly mappedMappings = computed(
    () =>
      this.mappingsService
        .mappings()
        .filter(
          mapping =>
            mapping.active
            && mapping.plantId !== null,
        )
        .length,
  );

  readonly unmappedMappings = computed(
    () =>
      this.mappingsService
        .mappings()
        .filter(
          mapping =>
            mapping.active
            && mapping.plantId === null,
        )
        .length,
  );

  readonly unmappedEmployees = computed(
    () =>
      this.mappingsService
        .mappings()
        .filter(
          mapping =>
            mapping.active
            && mapping.plantId === null,
        )
        .reduce(
          (
            total,
            mapping,
          ) =>
            total + mapping.employeeCount,
          0,
        ),
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

  async openEditDialog(
    mapping: SourceLocationMapping,
  ): Promise<void> {
    const dialogReference =
      this.dialog.open<
        SourceLocationMappingFormDialogComponent,
        SourceLocationMappingFormDialogData,
        SourceLocationMappingInput
      >(
        SourceLocationMappingFormDialogComponent,
        {
          width: '650px',
          maxWidth: 'calc(100vw - 32px)',
          disableClose: true,
          autoFocus: 'first-tabbable',

          data: {
            mapping,
            plants:
              this.plantsService.plants(),
          },
        },
      );

    const result =
      await firstValueFrom(
        dialogReference.afterClosed(),
      );

    if (!result) {
      return;
    }

    this.isSaving.set(true);

    try {
      await this.mappingsService.updateMapping(
        mapping.id,
        result,
      );

      this.snackBar.open(
        `La localidad ${mapping.sourceCode} fue actualizada. Los empleados relacionados ya reflejan la nueva planta.`,
        'Cerrar',
        {
          duration: 5000,
        },
      );
    } catch (error: unknown) {
      this.showDatabaseError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleMappingStatus(
    mapping: SourceLocationMapping,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.mappingsService
        .setMappingActive(
          mapping.id,
          !mapping.active,
        );

      this.snackBar.open(
        mapping.active
          ? 'La equivalencia fue desactivada.'
          : 'La equivalencia fue activada.',
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
      this.mappingsService.loadMappings(),
      this.plantsService.loadPlants(),
    ]);
  }

  private showDatabaseError(
    error: unknown,
  ): void {
    console.error(
      'Source location mapping operation failed.',
      error,
    );

    const databaseError =
      error as {
        code?: string;
        message?: string;
      };

    let message =
      'No fue posible guardar la equivalencia.';

    if (databaseError.code === '42501') {
      message =
        'No tienes permisos para modificar equivalencias.';
    }

    if (databaseError.code === '23505') {
      message =
        'Ya existe una equivalencia para ese código.';
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
