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

export interface ResetPasswordDialogData {
  displayName: string;
  email: string;
}

@Component({
  selector:
    'app-reset-password-dialog',

  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],

  templateUrl:
    './reset-password-dialog.component.html',

  styleUrl:
    './reset-password-dialog.component.scss',
})
export class ResetPasswordDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        ResetPasswordDialogComponent,
        string | undefined
      >,
    );

  readonly data =
    inject<ResetPasswordDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly form =
    this.formBuilder.nonNullable.group({
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
        ],
      ],

      confirmation: [
        '',
        [
          Validators.required,
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

    if (
      value.password
      !== value.confirmation
    ) {
      this.form.controls
        .confirmation
        .setErrors({
          mismatch: true,
        });

      return;
    }

    this.dialogRef.close(
      value.password,
    );
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
