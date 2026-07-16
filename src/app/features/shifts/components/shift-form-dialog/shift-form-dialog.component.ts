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
  Shift,
  ShiftInput,
} from '../../data-access/shifts.service';

export interface ShiftFormDialogData {
  shift: Shift | null;
}

function formatTimeInput(
  time: string | null,
): string {
  return time?.slice(0, 5) ?? '';
}

@Component({
  selector: 'app-shift-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl:
    './shift-form-dialog.component.html',
  styleUrl:
    './shift-form-dialog.component.scss',
})
export class ShiftFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        ShiftFormDialogComponent,
        ShiftInput | undefined
      >,
    );

  readonly data =
    inject<ShiftFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.shift !== null;

  readonly form =
    this.formBuilder.nonNullable.group({
      code: [
        this.data.shift?.code ?? '',
        [
          Validators.required,
          Validators.maxLength(20),
          Validators.pattern(
            /^[A-Za-z0-9_-]+$/,
          ),
        ],
      ],

      name: [
        this.data.shift?.name ?? '',
        [
          Validators.required,
          Validators.maxLength(100),
        ],
      ],

      startTime: [
        formatTimeInput(
          this.data.shift?.start_time ?? null,
        ),
        [
          Validators.pattern(
            /^([01]\d|2[0-3]):[0-5]\d$/,
          ),
        ],
      ],

      endTime: [
        formatTimeInput(
          this.data.shift?.end_time ?? null,
        ),
        [
          Validators.pattern(
            /^([01]\d|2[0-3]):[0-5]\d$/,
          ),
        ],
      ],

      displayOrder: [
        this.data.shift?.display_order ?? 0,
        [
          Validators.required,
          Validators.min(0),
          Validators.max(9999),
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

      startTime:
        value.startTime.trim() || null,

      endTime:
        value.endTime.trim() || null,

      displayOrder:
        value.displayOrder,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
