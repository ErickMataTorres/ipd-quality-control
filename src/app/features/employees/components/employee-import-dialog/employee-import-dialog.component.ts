import {
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatChipsModule,
} from '@angular/material/chips';

import {
  MatIconModule,
} from '@angular/material/icon';

import {
  MatProgressBarModule,
} from '@angular/material/progress-bar';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import {
  MatTableModule,
} from '@angular/material/table';

import {
  EmployeeImportPreview,
  EmployeeImportProgress,
  EmployeeImportService,
  EmployeeImportSummary,
} from '../../data-access/employee-import.service';

export interface EmployeeImportDialogResult {
  imported: boolean;
}

type ImportState =
  | 'idle'
  | 'parsing'
  | 'ready'
  | 'importing'
  | 'complete'
  | 'error';

@Component({
  selector: 'app-employee-import-dialog',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl:
    './employee-import-dialog.component.html',
  styleUrl:
    './employee-import-dialog.component.scss',
})
export class EmployeeImportDialogComponent {
  private readonly importService =
    inject(EmployeeImportService);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        EmployeeImportDialogComponent,
        EmployeeImportDialogResult
      >,
    );

  readonly state =
    signal<ImportState>('idle');

  readonly preview =
    signal<EmployeeImportPreview | null>(
      null,
    );

  readonly progress =
    signal<EmployeeImportProgress | null>(
      null,
    );

  readonly summary =
    signal<EmployeeImportSummary | null>(
      null,
    );

  readonly errorMessage = signal('');

  readonly previewColumns = [
    'employeeNumber',
    'fullName',
    'location',
    'shift',
    'line',
  ];

  async selectFile(
    event: Event,
  ): Promise<void> {
    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    input.value = '';

    if (!file) {
      return;
    }

    if (
      !/\.(xlsx|xlsm|xls)$/i.test(
        file.name,
      )
    ) {
      this.state.set('error');

      this.errorMessage.set(
        'Selecciona un archivo Excel con extensión .xlsx, .xlsm o .xls.',
      );

      return;
    }

    this.state.set('parsing');
    this.errorMessage.set('');
    this.preview.set(null);
    this.summary.set(null);

    try {
      const preview =
        await this.importService
          .parseHdcFile(file);

      this.preview.set(preview);
      this.state.set('ready');
    } catch (error: unknown) {
      console.error(
        'Unable to parse HDC workbook.',
        error,
      );

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No fue posible analizar el archivo.',
      );

      this.state.set('error');
    }
  }

  async importEmployees(): Promise<void> {
    const currentPreview =
      this.preview();

    if (
      !currentPreview
      || currentPreview.validRows.length === 0
    ) {
      return;
    }

    this.state.set('importing');
    this.errorMessage.set('');

    this.progress.set({
      processedRows: 0,
      totalRows:
        currentPreview.validRows.length,
      percentage: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(
        currentPreview.validRows.length
        / 500,
      ),
    });

    try {
      const summary =
        await this.importService
          .importEmployees(
            currentPreview.validRows,
            progress =>
              this.progress.set(progress),
          );

      this.summary.set(summary);
      this.state.set('complete');
    } catch (error: unknown) {
      console.error(
        'Employee import failed.',
        error,
      );

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'La importación no pudo completarse.',
      );

      this.state.set('error');
    }
  }

  reset(): void {
    this.state.set('idle');
    this.preview.set(null);
    this.progress.set(null);
    this.summary.set(null);
    this.errorMessage.set('');
  }

  close(): void {
    this.dialogRef.close({
      imported:
        this.summary() !== null,
    });
  }
}
