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
  Plant,
} from '../../../plants/data-access/plants.service';

import {
  ProductModel,
} from '../../../product-models/data-access/product-models.service';

import {
  ProductionLine,
  ProductionLineInput,
} from '../../data-access/production-lines.service';

export interface ProductionLineFormDialogData {
  line: ProductionLine | null;
  plants: Plant[];
  models: ProductModel[];
}

function getLocalDate(): string {
  const currentDate = new Date();

  const year = currentDate.getFullYear();

  const month = String(
    currentDate.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    currentDate.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-production-line-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl:
    './production-line-form-dialog.component.html',
  styleUrl:
    './production-line-form-dialog.component.scss',
})
export class ProductionLineFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        ProductionLineFormDialogComponent,
        ProductionLineInput | undefined
      >,
    );

  readonly data =
    inject<ProductionLineFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.line !== null;

  readonly availablePlants =
    this.data.plants.filter(
      plant =>
        plant.active
        || plant.id === this.data.line?.plant_id,
    );

  readonly availableModels =
    this.data.models.filter(
      model =>
        model.active
        || model.id
          === this.data.line?.product_model_id,
    );

  readonly form =
    this.formBuilder.nonNullable.group({
      plantId: [
        this.data.line?.plant_id ?? '',
        [
          Validators.required,
        ],
      ],

      name: [
        this.data.line?.name ?? '',
        [
          Validators.required,
          Validators.maxLength(120),
        ],
      ],

      displayOrder: [
        this.data.line?.display_order ?? 0,
        [
          Validators.required,
          Validators.min(0),
          Validators.max(9999),
        ],
      ],

      productModelId: [
        this.data.line?.product_model_id ?? '',
        [
          Validators.required,
        ],
      ],

      effectiveFrom: [
        this.data.line?.model_effective_from
          ?? getLocalDate(),
        [
          Validators.required,
        ],
      ],

      description: [
        this.data.line?.description ?? '',
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
      id: this.data.line?.id ?? null,
      plantId: value.plantId,
      name: value.name.trim(),
      displayOrder: value.displayOrder,
      productModelId: value.productModelId,
      effectiveFrom: value.effectiveFrom,
      description:
        value.description.trim() || null,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
