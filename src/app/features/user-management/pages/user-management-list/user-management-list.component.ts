import {
  DatePipe,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  firstValueFrom,
} from 'rxjs';

import {
  MatButtonModule,
} from '@angular/material/button';

import {
  MatChipsModule,
} from '@angular/material/chips';

import {
  MatDialog,
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
  MatMenuModule,
} from '@angular/material/menu';

import {
  MatProgressSpinnerModule,
} from '@angular/material/progress-spinner';

import {
  MatSelectModule,
} from '@angular/material/select';

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import {
  MatTableModule,
} from '@angular/material/table';

import {
  MatTooltipModule,
} from '@angular/material/tooltip';

import {
  AppRole,
  UserProfileService,
} from '../../../../core/user-profile/user-profile.service';

import {
  ResetPasswordDialogComponent,
  ResetPasswordDialogData,
} from '../../components/reset-password-dialog/reset-password-dialog.component';

import {
  UserFormDialogComponent,
  UserFormDialogData,
  UserFormDialogResult,
} from '../../components/user-form-dialog/user-form-dialog.component';

import {
  ManagedUser,
  UserManagementService,
} from '../../data-access/user-management.service';

type UserStatusFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'unconfigured';

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
    'app-user-management-list',

  imports: [
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],

  templateUrl:
    './user-management-list.component.html',

  styleUrl:
    './user-management-list.component.scss',
})
export class UserManagementListComponent
  implements OnInit {
  private readonly dialog =
    inject(MatDialog);

  private readonly snackBar =
    inject(MatSnackBar);

  private readonly userProfileService =
    inject(UserProfileService);

  readonly userManagementService =
    inject(UserManagementService);

  readonly searchTerm =
    signal('');

  readonly selectedRole =
    signal<'all' | AppRole>('all');

  readonly selectedStatus =
    signal<UserStatusFilter>('all');

  readonly displayedColumns = [
    'user',
    'email',
    'role',
    'plants',
    'lastSignIn',
    'status',
    'actions',
  ];

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

  readonly currentUserId =
    computed(
      () =>
        this.userProfileService
          .profile()
          ?.userId
        ?? '',
    );

  readonly filteredUsers =
    computed(() => {
      const search =
        this.searchTerm()
          .trim()
          .toLocaleLowerCase('es');

      const selectedRole =
        this.selectedRole();

      const selectedStatus =
        this.selectedStatus();

      return this.userManagementService
        .users()
        .filter(user => {
          if (
            selectedRole !== 'all'
            && user.profile?.role
              !== selectedRole
          ) {
            return false;
          }

          if (
            selectedStatus
              === 'unconfigured'
            && user.profile
          ) {
            return false;
          }

          if (
            selectedStatus === 'active'
            && !this.isUserActive(user)
          ) {
            return false;
          }

          if (
            selectedStatus === 'inactive'
            && (
              !user.profile
              || this.isUserActive(user)
            )
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          return [
            user.email,
            user.employee
              ?.employee_number
            ?? '',
            user.employee?.full_name
            ?? '',
            user.employee
              ?.department_name
            ?? '',
            user.employee
              ?.job_position
            ?? '',
            user.profile
              ? this.roleLabel(
                user.profile.role,
              )
              : 'sin configurar',
            ...user.plants.map(
              plant =>
                `${plant.code} ${plant.name}`,
            ),
          ]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(search);
        });
    });

  readonly totalUsers =
    computed(
      () =>
        this.userManagementService
          .users()
          .length,
    );

  readonly activeUsers =
    computed(
      () =>
        this.userManagementService
          .users()
          .filter(
            user =>
              this.isUserActive(user),
          )
          .length,
    );

  readonly inactiveUsers =
    computed(
      () =>
        this.userManagementService
          .users()
          .filter(
            user =>
              user.profile
              && !this.isUserActive(user),
          )
          .length,
    );

  readonly administratorUsers =
    computed(
      () =>
        this.userManagementService
          .users()
          .filter(
            user =>
              user.profile?.role
              === 'system_administrator'
              && this.isUserActive(user),
          )
          .length,
    );

  readonly unconfiguredUsers =
    computed(
      () =>
        this.userManagementService
          .users()
          .filter(
            user => !user.profile,
          )
          .length,
    );

  ngOnInit(): void {
    void this.userManagementService
      .loadUsers();
  }

  updateSearch(
    event: Event,
  ): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedRole.set('all');
    this.selectedStatus.set('all');
  }

  roleLabel(
    role: AppRole,
  ): string {
    return ROLE_LABELS[role];
  }

  isUserActive(
    user: ManagedUser,
  ): boolean {
    return user.profile?.active
      === true;
  }

  isCurrentUser(
    user: ManagedUser,
  ): boolean {
    return user.id
      === this.currentUserId();
  }

  userDisplayName(
    user: ManagedUser,
  ): string {
    return user.employee?.full_name
      || user.email
      || 'Usuario sin identificar';
  }

  async openCreateDialog():
    Promise<void> {
    const result =
      await this.openUserDialog(null);

    if (!result || !result.password) {
      return;
    }

    try {
      await this.userManagementService
        .createUser({
          email: result.email,
          password: result.password,
          employeeId:
            result.employeeId,
          role: result.role,
          defaultPlantId:
            result.defaultPlantId,
          plantIds:
            result.plantIds,
        });

      this.snackBar.open(
        'El usuario fue creado correctamente.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showOperationError(error);
    }
  }

  async openEditDialog(
    user: ManagedUser,
  ): Promise<void> {
    if (
      !user.profile
      || !user.employee
    ) {
      this.snackBar.open(
        'La cuenta no tiene un perfil de aplicación configurado.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return;
    }

    const result =
      await this.openUserDialog(user);

    if (!result) {
      return;
    }

    try {
      await this.userManagementService
        .updateUser({
          userId: user.id,
          email: result.email,
          employeeId:
            result.employeeId,
          role: result.role,
          defaultPlantId:
            result.defaultPlantId,
          plantIds:
            result.plantIds,
        });

      if (this.isCurrentUser(user)) {
        await this.userProfileService
          .loadCurrentProfile(true);
      }

      this.snackBar.open(
        'El usuario fue actualizado correctamente.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showOperationError(error);
    }
  }

  async toggleUserStatus(
    user: ManagedUser,
  ): Promise<void> {
    if (!user.profile) {
      return;
    }

    if (this.isCurrentUser(user)) {
      this.snackBar.open(
        'No puedes desactivar tu propia cuenta.',
        'Cerrar',
        {
          duration: 4500,
        },
      );

      return;
    }

    const nextStatus =
      !this.isUserActive(user);

    try {
      await this.userManagementService
        .setUserStatus(
          user.id,
          nextStatus,
        );

      this.snackBar.open(
        nextStatus
          ? 'El usuario fue activado.'
          : 'El usuario fue desactivado.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showOperationError(error);
    }
  }

  async openResetPasswordDialog(
    user: ManagedUser,
  ): Promise<void> {
    const dialogReference =
      this.dialog.open<
        ResetPasswordDialogComponent,
        ResetPasswordDialogData,
        string
      >(
        ResetPasswordDialogComponent,
        {
          width: '520px',
          maxWidth:
            'calc(100vw - 32px)',

          disableClose: true,

          data: {
            displayName:
              this.userDisplayName(user),

            email:
              user.email,
          },
        },
      );

    const password =
      await firstValueFrom(
        dialogReference.afterClosed(),
      );

    if (!password) {
      return;
    }

    try {
      await this.userManagementService
        .resetPassword(
          user.id,
          password,
        );

      this.snackBar.open(
        'La contraseña fue actualizada correctamente.',
        'Cerrar',
        {
          duration: 4000,
        },
      );
    } catch (error: unknown) {
      this.showOperationError(error);
    }
  }

  async reload(): Promise<void> {
    await this.userManagementService
      .loadUsers();
  }

  private async openUserDialog(
    user: ManagedUser | null,
  ): Promise<
    UserFormDialogResult | undefined
  > {
    const dialogReference =
      this.dialog.open<
        UserFormDialogComponent,
        UserFormDialogData,
        UserFormDialogResult
      >(
        UserFormDialogComponent,
        {
          width: '820px',
          maxWidth:
            'calc(100vw - 32px)',

          disableClose: true,
          autoFocus:
            'first-tabbable',

          data: {
            user,

            plants:
              this.userManagementService
                .plants(),
          },
        },
      );

    return firstValueFrom(
      dialogReference.afterClosed(),
    );
  }

  private showOperationError(
    error: unknown,
  ): void {
    console.error(
      'User management operation failed.',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'No fue posible completar la operación.';

    this.snackBar.open(
      message,
      'Cerrar',
      {
        duration: 5500,
      },
    );
  }
}
