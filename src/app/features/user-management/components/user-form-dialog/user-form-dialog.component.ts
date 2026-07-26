import {
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';

import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';

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
  MatSelectModule,
} from '@angular/material/select';

import {
  AppRole,
} from '../../../../core/user-profile/user-profile.service';

import {
  ManagedEmployee,
  ManagedEmployeeSearchResult,
  ManagedPlant,
  ManagedUser,
  UserManagementService,
} from '../../data-access/user-management.service';

export interface UserFormDialogData {
  user: ManagedUser | null;
  plants: ManagedPlant[];
}

export interface UserFormDialogResult {
  email: string;
  password: string | null;
  employeeId: string;
  role: AppRole;
  defaultPlantId: string | null;
  plantIds: string[];
}

const ROLE_LABELS:
  Record<AppRole, string> = {
    system_administrator:
      'Administrador del sistema',

    quality_manager:
      'Gerente de calidad',

    quality_supervisor:
      'Supervisor de calidad',

    viewer:
      'Usuario de consulta',
  };

@Component({
  selector:
    'app-user-form-dialog',

  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],

  templateUrl:
    './user-form-dialog.component.html',

  styleUrl:
    './user-form-dialog.component.scss',
})
export class UserFormDialogComponent
  implements OnDestroy {
  private readonly formBuilder =
    inject(FormBuilder);

  private readonly userManagementService =
    inject(UserManagementService);

  private readonly dialogRef =
    inject(
      MatDialogRef<
        UserFormDialogComponent,
        UserFormDialogResult | undefined
      >,
    );

  readonly data =
    inject<UserFormDialogData>(
      MAT_DIALOG_DATA,
    );

  readonly isEditMode =
    this.data.user !== null;

  readonly employeeSearchControl =
    new FormControl<string>(
      this.data.user?.employee?.id
      ?? '',
      {
        nonNullable: true,
      },
    );

  readonly employeeSearchTerm =
    signal('');

  readonly employeeSearchResults =
    signal<ManagedEmployeeSearchResult[]>(
      [],
    );

  readonly isSearchingEmployees =
    signal(false);

  readonly employeeSearchMessage =
    signal(
      'Escribe al menos 2 caracteres.',
    );

  readonly selectedEmployeeId =
    signal(
      this.data.user?.employee?.id
      ?? '',
    );

  private employeeSearchTimer:
    ReturnType<typeof setTimeout>
    | null = null;

  private employeeSearchRequestId = 0;

  readonly roleOptions:
    Array<{
      value: AppRole;
      label: string;
    }> = (
      Object.keys(
        ROLE_LABELS,
      ) as AppRole[]
    ).map(role => ({
      value: role,
      label: ROLE_LABELS[role],
    }));

  readonly activePlants =
    this.data.plants.filter(
      plant => plant.active,
    );

  readonly form =
    this.formBuilder.nonNullable.group({
      email: [
        this.data.user?.email ?? '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(254),
        ],
      ],

      password: [
        '',
        this.isEditMode
          ? []
          : [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(72),
          ],
      ],

      employeeId: [
        this.data.user
          ?.employee
          ?.id
        ?? '',
        [
          Validators.required,
        ],
      ],

      role: [
        (
          this.data.user
            ?.profile
            ?.role
          ?? 'quality_supervisor'
        ) as AppRole,
        [
          Validators.required,
        ],
      ],

      defaultPlantId: [
        this.data.user
          ?.profile
          ?.default_plant_id
        ?? '',
      ],

      plantIds: [
        this.data.user
          ?.plants
          .map(plant => plant.id)
        ?? [],
      ],
    });

  readonly selectedEmployee =
    computed<ManagedEmployee | null>(
      () => {
        const employeeId =
          this.selectedEmployeeId();

        if (!employeeId) {
          return null;
        }

        if (
          this.data.user?.employee?.id
          === employeeId
        ) {
          return this.data.user.employee;
        }

        return this.employeeSearchResults()
          .find(
            employee =>
              employee.id
              === employeeId,
          )
          ?? null;
      },
    );

  constructor() {
    const currentEmployee =
      this.data.user?.employee;

    if (currentEmployee) {
      this.employeeSearchTerm.set(
        currentEmployee.full_name,
      );

      this.employeeSearchResults.set([
        {
          ...currentEmployee,
          linkedUserId:
            this.data.user?.id ?? null,
        },
      ]);
    }
  }

  ngOnDestroy(): void {
    if (this.employeeSearchTimer) {
      clearTimeout(
        this.employeeSearchTimer,
      );
    }

    this.employeeSearchRequestId += 1;
  }

  displayEmployee = (
    employeeId: string | null,
  ): string => {
    if (!employeeId) {
      return '';
    }

    const employee =
      this.data.user?.employee?.id
        === employeeId
        ? this.data.user.employee
        : this.employeeSearchResults()
          .find(
            item =>
              item.id === employeeId,
          );

    if (!employee) {
      return '';
    }

    return `${employee.employee_number} · ${employee.full_name}`;
  };

  updateEmployeeSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    const search =
      input.value.trim();

    this.employeeSearchTerm.set(search);

    const selectedEmployee =
      this.selectedEmployee();

    if (
      selectedEmployee
      && input.value
        !== this.displayEmployee(
          selectedEmployee.id,
        )
    ) {
      this.form.controls
        .employeeId
        .setValue('');

      this.selectedEmployeeId.set('');
    }

    if (this.employeeSearchTimer) {
      clearTimeout(
        this.employeeSearchTimer,
      );
    }

    if (search.length < 2) {
      this.employeeSearchResults.set([]);
      this.employeeSearchMessage.set(
        'Escribe al menos 2 caracteres.',
      );
      this.isSearchingEmployees.set(false);
      return;
    }

    this.employeeSearchMessage.set('');
    this.isSearchingEmployees.set(true);

    this.employeeSearchTimer =
      setTimeout(
        () => {
          void this.searchEmployees(search);
        },
        300,
      );
  }

  private async searchEmployees(
    search: string,
  ): Promise<void> {
    const requestId =
      ++this.employeeSearchRequestId;

    try {
      const employees =
        await this.userManagementService
          .searchEmployees(search);

      if (
        requestId
        !== this.employeeSearchRequestId
      ) {
        return;
      }

      const availableEmployees =
        employees.filter(
          employee =>
            employee.active
            && employee.linkedUserId === null,
        );

      this.employeeSearchResults.set(
        availableEmployees,
      );

      this.employeeSearchMessage.set(
        availableEmployees.length > 0
          ? ''
          : 'No se encontraron empleados disponibles.',
      );
    } catch (error: unknown) {
      console.error(
        'Unable to search employees.',
        error,
      );

      if (
        requestId
        !== this.employeeSearchRequestId
      ) {
        return;
      }

      this.employeeSearchResults.set([]);
      this.employeeSearchMessage.set(
        'No fue posible buscar empleados.',
      );
    } finally {
      if (
        requestId
        === this.employeeSearchRequestId
      ) {
        this.isSearchingEmployees.set(
          false,
        );
      }
    }
  }

selectEmployee(
  event: MatAutocompleteSelectedEvent,
): void {
  const employeeId =
    event.option.value as string;

  this.form.controls
    .employeeId
    .setValue(employeeId);

  this.selectedEmployeeId.set(
    employeeId,
  );

  const employee =
    this.employeeSearchResults()
      .find(
        item =>
          item.id === employeeId,
      );

  if (!employee) {
    return;
  }

  const technicalEmail =
    `${employee.employee_number}@ipd.contec.internal`
      .toLowerCase();

  this.form.controls.email.setValue(
    technicalEmail,
  );

  this.employeeSearchTerm.set(
    employee.full_name,
  );

  const currentPlantIds =
    this.form.controls
      .plantIds.value;

  if (
    employee.plant_id
    && !currentPlantIds.includes(
      employee.plant_id,
    )
  ) {
    this.form.controls
      .plantIds
      .setValue([
        ...currentPlantIds,
        employee.plant_id,
      ]);
  }

  if (
    employee.plant_id
    && !this.form.controls
      .defaultPlantId.value
  ) {
    this.form.controls
      .defaultPlantId
      .setValue(
        employee.plant_id,
      );
  }
}

  handleRoleChange(
    role: AppRole,
  ): void {
    this.form.controls
      .role
      .setValue(role);

    if (
      role === 'system_administrator'
    ) {
      return;
    }

    const plantIds =
      this.form.controls
        .plantIds.value;

    if (
      plantIds.length > 0
      && !this.form.controls
        .defaultPlantId.value
    ) {
      this.form.controls
        .defaultPlantId
        .setValue(
          plantIds[0],
        );
    }
  }

  handlePlantAccessChange(
    plantIds: string[],
  ): void {
    this.form.controls
      .plantIds
      .setValue(plantIds);

    const defaultPlantId =
      this.form.controls
        .defaultPlantId.value;

    if (
      defaultPlantId
      && !plantIds.includes(
        defaultPlantId,
      )
    ) {
      this.form.controls
        .defaultPlantId
        .setValue(
          plantIds[0] ?? '',
        );
    }
  }

  handleDefaultPlantChange(
    plantId: string,
  ): void {
    this.form.controls
      .defaultPlantId
      .setValue(plantId);

    if (!plantId) {
      return;
    }

    const plantIds =
      this.form.controls
        .plantIds.value;

    if (!plantIds.includes(plantId)) {
      this.form.controls
        .plantIds
        .setValue([
          ...plantIds,
          plantId,
        ]);
    }
  }

  submit(): void {
    if (
      this.form.invalid
      || !this.form.controls
        .employeeId.value
    ) {
      this.form.markAllAsTouched();

      this.form.controls
        .employeeId
        .markAsTouched();

      return;
    }

    const value =
      this.form.getRawValue();

    const role =
      value.role;

    const plantIds =
      Array.from(
        new Set(value.plantIds),
      );

    const defaultPlantId =
      value.defaultPlantId
      || null;

    if (
      role !== 'system_administrator'
      && plantIds.length === 0
    ) {
      this.form.controls
        .plantIds
        .setErrors({
          requiredPlant: true,
        });

      return;
    }

    if (
      role !== 'system_administrator'
      && !defaultPlantId
    ) {
      this.form.controls
        .defaultPlantId
        .setErrors({
          requiredPlant: true,
        });

      return;
    }

    if (
      defaultPlantId
      && !plantIds.includes(
        defaultPlantId,
      )
    ) {
      this.form.controls
        .defaultPlantId
        .setErrors({
          invalidDefaultPlant: true,
        });

      return;
    }

    this.dialogRef.close({
      email:
        value.email
          .trim()
          .toLowerCase(),

      password:
        this.isEditMode
          ? null
          : value.password,

      employeeId:
        value.employeeId,

      role,
      defaultPlantId,
      plantIds,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
