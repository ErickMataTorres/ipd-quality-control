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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import {
  Plant,
  PlantInput,
} from '../../data-access/plants.service';

export interface PlantFormDialogData {
  plant: Plant | null;
}

@Component({
  selector: 'app-plant-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl:
    './plant-form-dialog.component.html',
  styleUrl:
    './plant-form-dialog.component.scss',
})
export class PlantFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        PlantFormDialogComponent,
        PlantInput | undefined
      >,
    );

  readonly data =
    inject<PlantFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.plant !== null;

  readonly form = this.formBuilder.nonNullable.group({
    code: [
      this.data.plant?.code ?? '',
      [
        Validators.required,
        Validators.maxLength(20),
        Validators.pattern(
          /^[A-Za-z0-9_-]+$/,
        ),
      ],
    ],
    name: [
      this.data.plant?.name ?? '',
      [
        Validators.required,
        Validators.maxLength(100),
      ],
    ],
    timezone: [
      this.data.plant?.timezone
        ?? 'America/Mazatlan',
      [
        Validators.required,
        Validators.maxLength(100),
      ],
    ],
    description: [
      this.data.plant?.description ?? '',
      [
        Validators.maxLength(500),
      ],
    ],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.dialogRef.close({
      code: value.code
        .trim()
        .toUpperCase(),
      name: value.name.trim(),
      timezone: value.timezone.trim(),
      description:
        value.description.trim() || null,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
