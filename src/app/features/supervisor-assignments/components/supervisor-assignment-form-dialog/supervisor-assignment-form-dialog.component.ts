import {
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  debounceTime,
  distinctUntilChanged,
  Subject,
} from 'rxjs';

import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';

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
  CreateSupervisorAssignmentsInput,
  SupervisorAssignment,
  SupervisorAssignmentsService,
  SupervisorCandidate,
  UpdateSupervisorAssignmentInput,
} from '../../data-access/supervisor-assignments.service';

export interface SupervisorAssignmentFormDialogData {
  assignment: SupervisorAssignment | null;
  plants: Plant[];
  lines: ProductionLine[];
  shifts: Shift[];
  defaultPlantId: string | null;
}

export type SupervisorAssignmentFormDialogResult =
  | {
      mode: 'create';
      value: CreateSupervisorAssignmentsInput;
    }
  | {
      mode: 'update';
      value: UpdateSupervisorAssignmentInput;
    };

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
  selector:
    'app-supervisor-assignment-form-dialog',

  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],

  templateUrl:
    './supervisor-assignment-form-dialog.component.html',

  styleUrl:
    './supervisor-assignment-form-dialog.component.scss',
})
export class SupervisorAssignmentFormDialogComponent {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly assignmentsService =
    inject(SupervisorAssignmentsService);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        SupervisorAssignmentFormDialogComponent,
        SupervisorAssignmentFormDialogResult
      >,
    );

  readonly data =
    inject<SupervisorAssignmentFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.assignment !== null;

  readonly candidates =
    signal<SupervisorCandidate[]>([]);

  readonly selectedCandidate =
    signal<SupervisorCandidate | null>(null);

  readonly availableLines =
    signal<ProductionLine[]>([]);

  readonly isSearchingEmployees =
    signal(false);

  readonly searchError = signal('');

  private readonly employeeSearchChanges =
    new Subject<string>();

  readonly availablePlants =
    this.data.plants.filter(
      plant =>
        plant.active
        || plant.id
          === this.data.assignment?.plantId,
    );

  readonly availableShifts =
    this.data.shifts.filter(
      shift =>
        shift.active
        || shift.id
          === this.data.assignment?.shiftId,
    );

  readonly form =
    this.formBuilder.nonNullable.group({
      plantId: [
        this.data.assignment?.plantId
        ?? this.data.defaultPlantId
        ?? '',
        [
          Validators.required,
        ],
      ],

      employeeSearch: [
        this.data.assignment
          ? `${this.data.assignment.supervisorName} · ${this.data.assignment.employeeNumber}`
          : '',
      ],

      supervisorEmployeeId: [
        this.data.assignment
          ?.supervisorEmployeeId
        ?? '',
      ],

      lineModelAssignmentIds: [
        this.data.assignment
          ? [
              this.data.assignment
                .lineModelAssignmentId,
            ]
          : [] as string[],
        [
          Validators.required,
        ],
      ],

      shiftId: [
        this.data.assignment?.shiftId
        ?? '',
        [
          Validators.required,
        ],
      ],

      effectiveFrom: [
        this.data.assignment?.effectiveFrom
        ?? getLocalDate(),
        [
          Validators.required,
        ],
      ],

      effectiveTo: [
        this.data.assignment?.effectiveTo
        ?? '',
      ],

      active: [
        this.data.assignment?.active
        ?? true,
      ],
    });

  constructor() {
    this.updateAvailableLines(
      this.form.controls.plantId.value,
    );

    this.employeeSearchChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(search => {
        void this.searchCandidates(search);
      });
  }

  handlePlantChange(
    plantId: string,
  ): void {
    this.form.patchValue({
      employeeSearch: '',
      supervisorEmployeeId: '',
      lineModelAssignmentIds: [],
    });

    this.selectedCandidate.set(null);
    this.candidates.set([]);
    this.searchError.set('');

    this.updateAvailableLines(plantId);
  }

  handleEmployeeSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    const search = input.value;

    this.form.controls
      .supervisorEmployeeId
      .setValue('');

    this.selectedCandidate.set(null);
    this.searchError.set('');

    if (search.trim().length < 2) {
      this.candidates.set([]);
      return;
    }

    this.employeeSearchChanges.next(search);
  }

  selectCandidate(
    event: MatAutocompleteSelectedEvent,
  ): void {
    const employeeNumber =
      String(event.option.value);

    const candidate =
      this.candidates().find(
        currentCandidate =>
          currentCandidate.employeeNumber
          === employeeNumber,
      );

    if (!candidate) {
      return;
    }

    this.selectedCandidate.set(candidate);

    this.form.patchValue({
      supervisorEmployeeId:
        candidate.id,

      employeeSearch:
        `${candidate.fullName} · ${candidate.employeeNumber}`,
    });

    this.candidates.set([]);
  }

  clearSelectedCandidate(): void {
    this.selectedCandidate.set(null);
    this.candidates.set([]);

    this.form.patchValue({
      employeeSearch: '',
      supervisorEmployeeId: '',
    });
  }


  initials(
    fullName: string,
  ): string {
    return fullName
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0).toUpperCase(),
      )
      .join('');
  }

  lineLabel(
    line: ProductionLine,
  ): string {
    const model =
      line.product_model_name
        ? ` · ${line.product_model_name}`
        : '';

    const year =
      line.model_year
        ? ` ${line.model_year}`
        : '';

    return `${line.name}${model}${year}`;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

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

    if (this.isEditMode) {
      const assignment =
        this.data.assignment;

      if (!assignment) {
        return;
      }

      this.dialogRef.close({
        mode: 'update',

        value: {
          assignmentId:
            assignment.id,

          shiftId:
            value.shiftId,

          effectiveFrom:
            value.effectiveFrom,

          effectiveTo,

          active:
            value.active,
        },
      });

      return;
    }

    if (
      !value.supervisorEmployeeId
      || value.lineModelAssignmentIds.length === 0
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      mode: 'create',

      value: {
        supervisorEmployeeId:
          value.supervisorEmployeeId,

        lineModelAssignmentIds:
          value.lineModelAssignmentIds,

        shiftId:
          value.shiftId,

        effectiveFrom:
          value.effectiveFrom,

        effectiveTo,
      },
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
          && line.active
          && line.line_model_assignment_id
            !== null,
      );

    this.availableLines.set(lines);
  }

  private async searchCandidates(
    search: string,
  ): Promise<void> {
    const plantId =
      this.form.controls.plantId.value;

    if (
      !plantId
      || search.trim().length < 2
    ) {
      this.candidates.set([]);
      return;
    }

    this.isSearchingEmployees.set(true);
    this.searchError.set('');

    try {
      const candidates =
        await this.assignmentsService
          .searchSupervisorCandidates(
            search,
            plantId,
          );

      this.candidates.set(candidates);

      if (candidates.length === 0) {
        this.searchError.set(
          'No se encontraron empleados activos en la planta seleccionada.',
        );
      }
    } catch (error: unknown) {
      console.error(
        'Unable to search supervisor candidates.',
        error,
      );

      this.candidates.set([]);
      this.searchError.set(
        'No fue posible buscar empleados.',
      );
    } finally {
      this.isSearchingEmployees.set(false);
    }
  }
}
