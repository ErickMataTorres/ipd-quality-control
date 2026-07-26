import {
  Component,
  inject,
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
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
  DefectType,
  DefectTypeInput,
} from '../../data-access/defect-types.service';

export interface DefectTypeFormDialogData {
  defectType: DefectType | null;
}

@Component({
  selector:
    'app-defect-type-form-dialog',

  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],

  templateUrl:
    './defect-type-form-dialog.component.html',

  styleUrl:
    './defect-type-form-dialog.component.scss',
})
export class DefectTypeFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        DefectTypeFormDialogComponent,
        DefectTypeInput | undefined
      >,
    );

  readonly data =
    inject<DefectTypeFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.defectType !== null;

  readonly form =
    this.formBuilder.nonNullable.group({
      code: [
        this.data.defectType?.code ?? '',
        [
          Validators.required,
          Validators.maxLength(100),
          Validators.pattern(
            /^[A-Za-z0-9_ ]+$/,
          ),
        ],
      ],

      nameEs: [
        this.data.defectType?.name_es
        ?? '',
        [
          Validators.required,
          Validators.maxLength(160),
        ],
      ],

      nameEn: [
        this.data.defectType?.name_en
        ?? '',
        [
          Validators.required,
          Validators.maxLength(160),
        ],
      ],

      category: [
        this.data.defectType?.category
        ?? '',
        [
          Validators.maxLength(100),
        ],
      ],

      displayOrder: [
        this.data.defectType
          ?.display_order
        ?? 0,
        [
          Validators.required,
          Validators.min(0),
          Validators.max(9999),
        ],
      ],

      description: [
        this.data.defectType?.description
        ?? '',
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

    const value =
      this.form.getRawValue();

    const displayOrder =
      Number(value.displayOrder);

    if (
      !Number.isInteger(displayOrder)
      || displayOrder < 0
      || displayOrder > 9999
    ) {
      this.form.controls
        .displayOrder
        .setErrors({
          invalidOrder: true,
        });

      return;
    }

    this.dialogRef.close({
      code:
        value.code
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_'),

      nameEs:
        value.nameEs.trim(),

      nameEn:
        value.nameEn.trim(),

      category:
        value.category.trim()
        || null,

      description:
        value.description.trim()
        || null,

      displayOrder,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
