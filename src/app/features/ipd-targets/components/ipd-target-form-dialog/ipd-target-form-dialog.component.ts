import {
  Component,
  inject,
  signal,
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
  ProductionLine,
} from '../../../production-lines/data-access/production-lines.service';

import {
  Shift,
} from '../../../shifts/data-access/shifts.service';

import {
  IpdTarget,
  IpdTargetInput,
} from '../../data-access/ipd-targets.service';

export interface IpdTargetFormDialogData {
  target: IpdTarget | null;
  plants: Plant[];
  lines: ProductionLine[];
  shifts: Shift[];
  defaultPlantId: string | null;
}

function getLocalDate(): string {
  const currentDate = new Date();

  const year =
    currentDate.getFullYear();

  const month = String(
    currentDate.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    currentDate.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-ipd-target-form-dialog',

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
    './ipd-target-form-dialog.component.html',

  styleUrl:
    './ipd-target-form-dialog.component.scss',
})
export class IpdTargetFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        IpdTargetFormDialogComponent,
        IpdTargetInput | undefined
      >,
    );

  readonly data =
    inject<IpdTargetFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.target !== null;

  readonly availableLines =
    signal<ProductionLine[]>([]);

  readonly availablePlants =
    this.data.plants.filter(
      plant =>
        plant.active
        || plant.id ===
          this.data.target?.plantId,
    );

  readonly availableShifts =
    this.data.shifts.filter(
      shift =>
        shift.active
        || shift.id ===
          this.data.target?.shiftId,
    );

  readonly form =
    this.formBuilder.nonNullable.group({
      plantId: [
        this.data.target?.plantId
        ?? this.data.defaultPlantId
        ?? '',
        [
          Validators.required,
        ],
      ],

      lineModelAssignmentId: [
        this.data.target
          ?.lineModelAssignmentId
        ?? '',
        [
          Validators.required,
        ],
      ],

      shiftId: [
        this.data.target?.shiftId
        ?? 'general',
        [
          Validators.required,
        ],
      ],

      targetPercentage: [
        this.data.target
          ?.targetPercentage
        ?? 1,
        [
          Validators.required,
          Validators.min(0),
          Validators.max(9999),
        ],
      ],

      effectiveFrom: [
        this.data.target
          ?.effectiveFrom
        ?? getLocalDate(),
        [
          Validators.required,
        ],
      ],

      effectiveTo: [
        this.data.target
          ?.effectiveTo
        ?? '',
      ],

      active: [
        this.data.target?.active
        ?? true,
      ],
    });

  constructor() {
    this.updateAvailableLines(
      this.form.controls.plantId.value,
    );
  }

  handlePlantChange(
    plantId: string,
  ): void {
    this.form.controls
      .lineModelAssignmentId
      .setValue('');

    this.updateAvailableLines(plantId);
  }

  lineLabel(
    line: ProductionLine,
  ): string {
    const modelName =
      line.product_model_name
        ? ` · ${line.product_model_name}`
        : '';

    const modelYear =
      line.model_year
        ? ` ${line.model_year}`
        : '';

    return `${line.name}${modelName}${modelYear}`;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value =
      this.form.getRawValue();

    const effectiveTo =
      value.effectiveTo.trim() || null;

    if (
      effectiveTo
      && effectiveTo < value.effectiveFrom
    ) {
      this.form.controls.effectiveTo.setErrors({
        beforeStart: true,
      });

      return;
    }

    this.dialogRef.close({
      targetId:
        this.data.target?.id ?? null,

      lineModelAssignmentId:
        value.lineModelAssignmentId,

      shiftId:
        value.shiftId === 'general'
          ? null
          : value.shiftId,

      targetPercentage:
        Number(value.targetPercentage),

      effectiveFrom:
        value.effectiveFrom,

      effectiveTo,

      active:
        value.active,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private updateAvailableLines(
    plantId: string,
  ): void {
    const lines =
      this.data.lines.filter(
        line =>
          line.plant_id === plantId
          && (
            line.active
            || line.line_model_assignment_id ===
              this.data.target
                ?.lineModelAssignmentId
          )
          && line.line_model_assignment_id
            !== null,
      );

    this.availableLines.set(lines);
  }
}
