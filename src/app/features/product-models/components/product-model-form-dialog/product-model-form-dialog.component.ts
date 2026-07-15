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

import {
  ProductModel,
  ProductModelInput,
} from '../../data-access/product-models.service';

export interface ProductModelFormDialogData {
  model: ProductModel | null;
}

@Component({
  selector: 'app-product-model-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl:
    './product-model-form-dialog.component.html',
  styleUrl:
    './product-model-form-dialog.component.scss',
})
export class ProductModelFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        ProductModelFormDialogComponent,
        ProductModelInput | undefined
      >,
    );

  readonly data =
    inject<ProductModelFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.model !== null;

  readonly form =
    this.formBuilder.nonNullable.group({
      name: [
        this.data.model?.name ?? '',
        [
          Validators.required,
          Validators.maxLength(120),
        ],
      ],
      modelYear: [
        this.data.model?.model_year
          ?.toString() ?? '',
        [
          Validators.pattern(/^\d{4}$/),
        ],
      ],
      description: [
        this.data.model?.description ?? '',
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

    const modelYear =
      value.modelYear.trim()
        ? Number(value.modelYear)
        : null;

    if (
      modelYear !== null
      && (
        modelYear < 1980
        || modelYear > 2200
      )
    ) {
      this.form.controls.modelYear.setErrors({
        invalidYear: true,
      });

      return;
    }

    this.dialogRef.close({
      name: value.name.trim(),
      modelYear,
      description:
        value.description.trim() || null,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
