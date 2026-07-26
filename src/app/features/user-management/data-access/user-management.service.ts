import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  SupabaseService,
} from '../../../core/services/supabase';

import {
  AppRole,
  ThemePreference,
} from '../../../core/user-profile/user-profile.service';

export interface ManagedEmployee {
  id: string;
  employee_number: string;
  full_name: string;
  plant_id: string | null;
  shift_id: string | null;
  department_name: string | null;
  job_position: string | null;
  photo_path: string | null;
  active: boolean;
}

export interface ManagedEmployeeSearchResult
  extends ManagedEmployee {
  linkedUserId: string | null;
}

export interface ManagedPlant {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface ManagedUserProfile {
  id: string;
  employee_id: string;
  role: AppRole;
  default_plant_id: string | null;
  preferred_theme: ThemePreference;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  authCreatedAt: string;
  bannedUntil: string | null;
  profile: ManagedUserProfile | null;
  employee: ManagedEmployee | null;
  defaultPlant: ManagedPlant | null;
  plants: ManagedPlant[];
}

export interface UserManagementListResponse {
  users: ManagedUser[];
  employees: ManagedEmployee[];
  plants: ManagedPlant[];
}

export interface CreateManagedUserInput {
  email: string;
  password: string;
  employeeId: string;
  role: AppRole;
  defaultPlantId: string | null;
  plantIds: string[];
}

export interface UpdateManagedUserInput {
  userId: string;
  email: string;
  employeeId: string;
  role: AppRole;
  defaultPlantId: string | null;
  plantIds: string[];
}

interface FunctionErrorResponse {
  error?: string;
  code?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  private readonly supabase =
    inject(SupabaseService);

  readonly users =
    signal<ManagedUser[]>([]);

  readonly employees =
    signal<ManagedEmployee[]>([]);

  readonly plants =
    signal<ManagedPlant[]>([]);

  readonly isLoading =
    signal(false);

  readonly isSaving =
    signal(false);

  readonly errorMessage =
    signal('');

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response =
        await this.invoke<
          UserManagementListResponse
        >({
          action: 'list',
        });

      this.users.set(
        response.users ?? [],
      );

      this.employees.set(
        (response.employees ?? [])
          .sort(
            (left, right) =>
              left.full_name.localeCompare(
                right.full_name,
                'es',
                {
                  sensitivity: 'base',
                },
              ),
          ),
      );

      this.plants.set(
        (response.plants ?? [])
          .sort(
            (left, right) =>
              left.code.localeCompare(
                right.code,
                'es',
                {
                  numeric: true,
                },
              ),
          ),
      );
    } catch (error: unknown) {
      console.error(
        'Unable to load managed users.',
        error,
      );

      this.errorMessage.set(
        this.errorText(
          error,
          'No fue posible cargar los usuarios.',
        ),
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async searchEmployees(
    search: string,
  ): Promise<ManagedEmployeeSearchResult[]> {
    const normalizedSearch =
      search.trim();

    if (normalizedSearch.length < 2) {
      return [];
    }

    const response =
      await this.invoke<{
        employees:
          ManagedEmployeeSearchResult[];
      }>({
        action: 'search-employees',
        search: normalizedSearch,
      });

    return response.employees ?? [];
  }

  async createUser(
    input: CreateManagedUserInput,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.invoke({
        action: 'create',
        email: input.email,
        password: input.password,
        employeeId: input.employeeId,
        role: input.role,
        defaultPlantId:
          input.defaultPlantId,
        plantIds: input.plantIds,
      });

      await this.loadUsers();
    } finally {
      this.isSaving.set(false);
    }
  }

  async updateUser(
    input: UpdateManagedUserInput,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.invoke({
        action: 'update',
        userId: input.userId,
        email: input.email,
        employeeId: input.employeeId,
        role: input.role,
        defaultPlantId:
          input.defaultPlantId,
        plantIds: input.plantIds,
      });

      await this.loadUsers();
    } finally {
      this.isSaving.set(false);
    }
  }

  async setUserStatus(
    userId: string,
    active: boolean,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.invoke({
        action: 'set-status',
        userId,
        active,
      });

      await this.loadUsers();
    } finally {
      this.isSaving.set(false);
    }
  }

  async resetPassword(
    userId: string,
    password: string,
  ): Promise<void> {
    this.isSaving.set(true);

    try {
      await this.invoke({
        action: 'reset-password',
        userId,
        password,
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  private async invoke<T>(
    body: Record<string, unknown>,
  ): Promise<T> {
    const {
      data,
      error,
    } =
      await this.supabase.client
        .functions
        .invoke<T>(
          'manage-users',
          {
            body,
          },
        );

    if (error) {
      let message =
        error.message
        || 'Edge Function request failed.';

      const context =
        (
          error as {
            context?: Response;
          }
        ).context;

      if (context) {
        try {
          const responseBody =
            (
              await context
                .clone()
                .json()
            ) as FunctionErrorResponse;

          message =
            responseBody.error
            || message;
        } catch {
          // Keep the original error message.
        }
      }

      throw new Error(message);
    }

    const responseBody =
      data as T & FunctionErrorResponse;

    if (responseBody?.error) {
      throw new Error(
        responseBody.error,
      );
    }

    return data as T;
  }

  private errorText(
    error: unknown,
    fallback: string,
  ): string {
    if (
      error instanceof Error
      && error.message
    ) {
      return error.message;
    }

    return fallback;
  }
}
