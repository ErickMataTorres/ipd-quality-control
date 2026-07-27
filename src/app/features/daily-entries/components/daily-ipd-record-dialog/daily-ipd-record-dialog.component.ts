import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  FormArray,
  FormControl,
  FormGroup,
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
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import { MatSelectModule } from '@angular/material/select';

import {
  AssignedSupervisor,
  DailyEntriesService,
  DailyOperationBoardItem,
  DailyRecordDefectInput,
  DailyRecordSaveStatus,
  DefectType,
  SaveDailyRecordInput,
} from '../../data-access/daily-entries.service';

type DefectFormGroup = FormGroup<{
  defectTypeId: FormControl<string>;
  quantity: FormControl<number>;
  comment: FormControl<string>;
}>;

export interface DailyIpdRecordDialogData {
  item: DailyOperationBoardItem;
  productionDate: string;
  defectTypes: DefectType[];
}

export interface DailyIpdRecordDialogResult {
  saved: boolean;
}

@Component({
  selector: 'app-daily-ipd-record-dialog',

  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],

  templateUrl:
    './daily-ipd-record-dialog.component.html',

  styleUrl:
    './daily-ipd-record-dialog.component.scss',
})
export class DailyIpdRecordDialogComponent
  implements OnInit {
  private readonly entriesService =
    inject(DailyEntriesService);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        DailyIpdRecordDialogComponent,
        DailyIpdRecordDialogResult
      >,
    );

  readonly data =
    inject<DailyIpdRecordDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isLoading =
    signal(this.data.item.recordId !== null);

  readonly isSaving =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly defects =
    new FormArray<DefectFormGroup>([]);

  readonly form =
    new FormGroup({
      supervisorEmployeeId:
        new FormControl(
          this.resolveInitialSupervisorId(),
          {
            nonNullable: true,
            validators: [
              Validators.required,
            ],
          },
        ),

      producedQuantity:
        new FormControl(
          this.data.item.producedQuantity ?? 0,
          {
            nonNullable: true,
            validators: [
              Validators.required,
              Validators.min(0),
            ],
          },
        ),

      defectiveHarnessQuantity:
        new FormControl(
          this.data.item
            .defectiveHarnessQuantity
          ?? 0,
          {
            nonNullable: true,
            validators: [
              Validators.required,
              Validators.min(0),
            ],
          },
        ),

      comment:
        new FormControl(
          this.data.item.comment ?? '',
          {
            nonNullable: true,
            validators: [
              Validators.maxLength(2000),
            ],
          },
        ),

      defects:
        this.defects,
    });

  get totalDefects(): number {
    return this.defects.controls.reduce(
      (
        total,
        defectControl,
      ) =>
        total
        + Number(
          defectControl.controls
            .quantity.value
          || 0,
        ),
      0,
    );
  }

  get defectiveHarnessQuantity(): number {
  return Number(
    this.form.controls
      .defectiveHarnessQuantity.value
    || 0,
  );
}

get defectConsistencyMessage():
  string | null {
  const defectiveHarnessQuantity =
    this.defectiveHarnessQuantity;

  if (
    defectiveHarnessQuantity === 0
    && this.totalDefects > 0
  ) {
    return (
      'Registraste defectos, pero la cantidad '
      + 'de arneses defectuosos es cero.'
    );
  }

  if (
    this.totalDefects
    < defectiveHarnessQuantity
  ) {
    return (
      'El total de defectos no puede ser menor '
      + 'que la cantidad de arneses defectuosos. '
      + 'Cada arnés defectuoso debe tener al '
      + 'menos un defecto registrado.'
    );
  }

  return null;
}

get hasDefectConsistencyIssue(): boolean {
  return this.defectConsistencyMessage
    !== null;
}

  get previewIpd(): number | null {
    const producedQuantity =
      Number(
        this.form.controls
          .producedQuantity.value,
      );

    if (producedQuantity <= 0) {
      return null;
    }

    return Number(
      (
        (
          this.totalDefects
          / producedQuantity
        ) * 100
      ).toFixed(4),
    );
  }

  get effectiveTarget(): number | null {
    return this.data.item.recordId
      ? this.data.item
          .recordTargetPercentage
      : this.data.item.targetPercentage;
  }

get previewIsWithinTarget():
  boolean | null {
  if (this.hasDefectConsistencyIssue) {
    return null;
  }

  const ipd = this.previewIpd;
  const target = this.effectiveTarget;

    if (
      ipd === null
      || target === null
    ) {
      return null;
    }

    return ipd <= target;
  }

  ngOnInit(): void {
    void this.loadExistingDefects();
  }

  availableDefectTypes(
    rowIndex: number,
  ): DefectType[] {
    const currentDefectTypeId =
      this.defects.at(rowIndex)
        .controls.defectTypeId.value;

    const selectedIds =
      new Set(
        this.defects.controls
          .map(
            control =>
              control.controls
                .defectTypeId.value,
          )
          .filter(Boolean),
      );

    return this.data.defectTypes.filter(
      defectType =>
        defectType.id
          === currentDefectTypeId
        || !selectedIds.has(defectType.id),
    );
  }

  addDefect(): void {
    if (
      this.defects.length
      >= this.data.defectTypes.length
    ) {
      return;
    }

    this.defects.push(
      this.createDefectGroup(),
    );
  }

  removeDefect(
    rowIndex: number,
  ): void {
    this.defects.removeAt(rowIndex);
  }

  async saveDraft(): Promise<void> {
    await this.save('draft');
  }

async submitRecord(): Promise<void> {
  const producedQuantity =
    this.form.controls
      .producedQuantity.value;

  if (producedQuantity <= 0) {
    this.errorMessage.set(
      'Para enviar el registro, la producción debe ser mayor que cero.',
    );

    return;
  }

  const consistencyMessage =
    this.defectConsistencyMessage;

  if (consistencyMessage) {
    this.errorMessage.set(
      consistencyMessage,
    );

    return;
  }

  await this.save('submitted');
}

  async saveNoProduction(): Promise<void> {
    this.form.controls
      .producedQuantity
      .setValue(0);

    this.form.controls
      .defectiveHarnessQuantity
      .setValue(0);

    this.defects.clear();

    await this.save('no_production');
  }

  close(): void {
    this.dialogRef.close({
      saved: false,
    });
  }

  private createDefectGroup(
    value?: DailyRecordDefectInput,
  ): DefectFormGroup {
    return new FormGroup({
      defectTypeId:
        new FormControl(
          value?.defectTypeId ?? '',
          {
            nonNullable: true,
            validators: [
              Validators.required,
            ],
          },
        ),

      quantity:
        new FormControl(
          value?.quantity ?? 1,
          {
            nonNullable: true,
            validators: [
              Validators.required,
              Validators.min(1),
            ],
          },
        ),

      comment:
        new FormControl(
          value?.comment ?? '',
          {
            nonNullable: true,
            validators: [
              Validators.maxLength(1000),
            ],
          },
        ),
    });
  }

  private async loadExistingDefects():
    Promise<void> {
    const recordId =
      this.data.item.recordId;

    if (!recordId) {
      this.isLoading.set(false);
      return;
    }

    try {
      const defects =
        await this.entriesService
          .loadRecordDefects(recordId);

      this.defects.clear();

      for (const defect of defects) {
        this.defects.push(
          this.createDefectGroup({
            defectTypeId:
              defect.defectTypeId,

            quantity:
              defect.quantity,

            comment:
              defect.comment,
          }),
        );
      }
    } catch (error: unknown) {
      console.error(
        'Unable to load record defects.',
        error,
      );

      this.errorMessage.set(
        'No fue posible cargar el detalle de defectos.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private async save(
    status: DailyRecordSaveStatus,
  ): Promise<void> {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value =
      this.form.getRawValue();

    if (
      value.defectiveHarnessQuantity
      > value.producedQuantity
    ) {
      this.errorMessage.set(
        'Los arneses defectuosos no pueden superar a los arneses producidos.',
      );

      return;
    }

    const defectTypeIds =
      value.defects.map(
        defect =>
          defect.defectTypeId,
      );

    if (
      new Set(defectTypeIds).size
      !== defectTypeIds.length
    ) {
      this.errorMessage.set(
        'No puedes repetir el mismo tipo de defecto.',
      );

      return;
    }

    this.isSaving.set(true);

    try {
      const defects:
        DailyRecordDefectInput[] =
        value.defects.map(
          defect => ({
            defectTypeId:
              defect.defectTypeId,

            quantity:
              Number(defect.quantity),

            comment:
              defect.comment.trim()
              || null,
          }),
        );

      const input: SaveDailyRecordInput = {
        recordId:
          this.data.item.recordId,

        productionDate:
          this.data.productionDate,

        lineModelAssignmentId:
          this.data.item
            .lineModelAssignmentId,

        shiftId:
          this.data.item.shiftId,

        supervisorEmployeeId:
          value.supervisorEmployeeId,

        producedQuantity:
          Number(value.producedQuantity),

        defectiveHarnessQuantity:
          Number(
            value.defectiveHarnessQuantity,
          ),

        comment:
          value.comment.trim() || null,

        status,

        expectedVersion:
          this.data.item.version,

        defects,
      };

      await this.entriesService
        .saveRecord(input);

      this.dialogRef.close({
        saved: true,
      });
    } catch (error: unknown) {
      console.error(
        'Unable to save daily IPD record.',
        error,
      );

      this.errorMessage.set(
        this.resolveDatabaseError(error),
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  private resolveInitialSupervisorId():
    string {
    const existingSupervisorId =
      this.data.item
        .supervisorEmployeeId;

    if (existingSupervisorId) {
      return existingSupervisorId;
    }

    const supervisors =
      this.data.item
        .assignedSupervisors;

    if (supervisors.length === 1) {
      return supervisors[0].employeeId;
    }

    return supervisors[0]?.employeeId ?? '';
  }

  private resolveDatabaseError(
    error: unknown,
  ): string {
    const databaseError =
      error as {
        code?: string;
        message?: string;
      };

    if (databaseError.code === '23505') {
      return 'Ya existe un registro para esta fecha, línea, modelo y turno.';
    }

    if (databaseError.code === '40001') {
      return 'El registro cambió en otra computadora. Cierra esta ventana, actualiza y vuelve a intentarlo.';
    }

    if (databaseError.code === '42501') {
      return 'No tienes permisos para guardar este registro o el supervisor no está asignado a la línea.';
    }

    if (databaseError.code === 'P2001') {
  return (
    'El total de defectos no puede ser menor '
    + 'que la cantidad de arneses defectuosos. '
    + 'Cada arnés defectuoso debe tener al '
    + 'menos un defecto registrado.'
  );
}

if (databaseError.code === 'P2002') {
  return (
    'Registraste defectos, pero la cantidad '
    + 'de arneses defectuosos es cero.'
  );
}

if (databaseError.code === 'P2000') {
  return (
    'Para enviar el registro, la producción '
    + 'debe ser mayor que cero.'
  );
}

if (databaseError.code === 'P2003') {
  return (
    'Los arneses defectuosos no pueden superar '
    + 'a los arneses producidos.'
  );
}

    if (databaseError.code === '22023') {
      return 'Revisa las cantidades, fechas y tipos de defecto capturados.';
    }

    if (databaseError.code === 'P0002') {
      return 'El registro ya no existe.';
    }

    return 'No fue posible guardar el registro diario.';
  }
}
