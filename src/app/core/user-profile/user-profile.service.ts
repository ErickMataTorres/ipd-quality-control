import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../services/supabase';
import { Database } from '../types/database.types';

export type AppRole =
  Database['public']['Enums']['app_role'];

export type ThemePreference =
  Database['public']['Enums']['theme_preference'];

interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  fullName: string;
  photoPath: string | null;
}

interface PlantSummary {
  id: string;
  code: string;
  name: string;
}

export interface CurrentUserProfile {
  userId: string;
  role: AppRole;
  preferredTheme: ThemePreference;
  defaultPlantId: string | null;
  employee: EmployeeSummary;
  defaultPlant: PlantSummary | null;
}

const ROLE_LABELS: Record<AppRole, string> = {
  system_administrator: 'Administrador del sistema',
  quality_manager: 'Gerente de calidad',
  quality_supervisor: 'Supervisor de calidad',
  viewer: 'Usuario de consulta',
};

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  readonly profile = signal<CurrentUserProfile | null>(
    null,
  );

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly fullName = computed(
    () => this.profile()?.employee.fullName ?? '',
  );

  readonly employeeNumber = computed(
    () => this.profile()?.employee.employeeNumber ?? '',
  );

  readonly role = computed(
    () => this.profile()?.role ?? null,
  );

  readonly roleLabel = computed(() => {
    const currentRole = this.role();

    return currentRole
      ? ROLE_LABELS[currentRole]
      : '';
  });

  readonly plantName = computed(
    () =>
      this.profile()?.defaultPlant?.name
      ?? 'Sin planta predeterminada',
  );

  readonly initials = computed(() => {
    const name = this.fullName().trim();

    if (!name) {
      return '';
    }

    return name
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  });

  async loadCurrentProfile(
    forceReload = false,
  ): Promise<CurrentUserProfile | null> {
    const session =
      this.authService.session()
      ?? await this.authService.getSession();

    const user = session?.user;

    if (!user) {
      this.clear();
      return null;
    }

    const currentProfile = this.profile();

    if (
      currentProfile
      && currentProfile.userId === user.id
      && !forceReload
    ) {
      return currentProfile;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const {
        data: profileRow,
        error: profileError,
      } = await this.supabase.client
        .from('user_profiles')
        .select(`
          id,
          employee_id,
          role,
          preferred_theme,
          default_plant_id,
          active
        `)
        .eq('id', user.id)
        .eq('active', true)
        .single();

      if (profileError) {
        throw profileError;
      }

      const employeeQuery = this.supabase.client
        .from('employees')
        .select(`
          id,
          employee_number,
          full_name,
          photo_path
        `)
        .eq('id', profileRow.employee_id)
        .single();

      const plantQuery =
        profileRow.default_plant_id
          ? this.supabase.client
              .from('plants')
              .select(`
                id,
                code,
                name
              `)
              .eq('id', profileRow.default_plant_id)
              .single()
          : Promise.resolve({
              data: null,
              error: null,
            });

      const [
        employeeResult,
        plantResult,
      ] = await Promise.all([
        employeeQuery,
        plantQuery,
      ]);

      if (employeeResult.error) {
        throw employeeResult.error;
      }

      if (plantResult.error) {
        throw plantResult.error;
      }

      const loadedProfile: CurrentUserProfile = {
        userId: profileRow.id,
        role: profileRow.role,
        preferredTheme: profileRow.preferred_theme,
        defaultPlantId: profileRow.default_plant_id,
        employee: {
          id: employeeResult.data.id,
          employeeNumber:
            employeeResult.data.employee_number,
          fullName: employeeResult.data.full_name,
          photoPath: employeeResult.data.photo_path,
        },
        defaultPlant: plantResult.data
          ? {
              id: plantResult.data.id,
              code: plantResult.data.code,
              name: plantResult.data.name,
            }
          : null,
      };

      this.profile.set(loadedProfile);

      return loadedProfile;
    } catch (error: unknown) {
      console.error(
        'Unable to load the current user profile.',
        error,
      );

      this.profile.set(null);
      this.errorMessage.set(
        'No fue posible cargar la información del usuario.',
      );

      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

async updatePreferences(
  preferredTheme: ThemePreference,
): Promise<void> {
  const currentProfile = this.profile();

  if (!currentProfile) {
    throw new Error(
      'The current user profile is not loaded.',
    );
  }

  const { error } = await this.supabase.client.rpc(
    'update_my_preferences',
    {
      preferred_theme_value: preferredTheme,
      default_plant_value:
        currentProfile.defaultPlantId ?? undefined,
    },
  );

  if (error) {
    throw error;
  }

  this.profile.set({
    ...currentProfile,
    preferredTheme,
  });
}

  clear(): void {
    this.profile.set(null);
    this.errorMessage.set('');
    this.isLoading.set(false);
  }
}
