import {
  Component,
  inject,
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';

import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import {
  MatFormFieldModule,
} from '@angular/material/form-field';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';

import {
  Plant,
} from '../../../plants/data-access/plants.service';

import {
  SourceLocationMapping,
  SourceLocationMappingInput,
} from '../../data-access/source-location-mappings.service';

export interface SourceLocationMappingFormDialogData {
  mapping: SourceLocationMapping;
  plants: Plant[];
}

@Component({
  selector:
    'app-source-location-mapping-form-dialog',

  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],

  templateUrl:
    './source-location-mapping-form-dialog.component.html',

  styleUrl:
    './source-location-mapping-form-dialog.component.scss',
})
export class SourceLocationMappingFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        SourceLocationMappingFormDialogComponent,
        SourceLocationMappingInput | undefined
      >,
    );

  readonly data =
    inject<SourceLocationMappingFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly availablePlants =
    this.data.plants.filter(
      plant =>
        plant.active
        || plant.id === this.data.mapping.plantId,
    );

  readonly form =
    this.formBuilder.nonNullable.group({
      plantId: [
        this.data.mapping.plantId ?? '',
      ],

      displayName: [
        this.data.mapping.displayName ?? '',
        [
          Validators.maxLength(150),
        ],
      ],

      notes: [
        this.data.mapping.notes ?? '',
        [
          Validators.maxLength(1000),
        ],
      ],

      active: [
        this.data.mapping.active,
      ],
    });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.dialogRef.close({
      plantId:
        value.plantId || null,

      displayName:
        value.displayName.trim() || null,

      notes:
        value.notes.trim() || null,

      active:
        value.active,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
