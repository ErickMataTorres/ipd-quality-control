import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase';
import { Database } from '../../../core/types/database.types';

type PlantRow =
  Database['public']['Tables']['plants']['Row'];

type PlantInsert =
  Database['public']['Tables']['plants']['Insert'];

type PlantUpdate =
  Database['public']['Tables']['plants']['Update'];

export type Plant = Pick<
  PlantRow,
  | 'id'
  | 'code'
  | 'name'
  | 'timezone'
  | 'description'
  | 'active'
  | 'created_at'
  | 'updated_at'
>;

export interface PlantInput {
  code: string;
  name: string;
  timezone: string;
  description: string | null;
}

const PLANT_COLUMNS = `
  id,
  code,
  name,
  timezone,
  description,
  active,
  created_at,
  updated_at
`;

@Injectable({
  providedIn: 'root',
})
export class PlantsService {
  private readonly supabase = inject(SupabaseService);

  readonly plants = signal<Plant[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadPlants(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } = await this.supabase.client
        .from('plants')
        .select(PLANT_COLUMNS)
        .order('active', {
          ascending: false,
        })
        .order('name', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      this.plants.set(data ?? []);
    } catch (error: unknown) {
      console.error(
        'Unable to load plants.',
        error,
      );

      this.errorMessage.set(
        'No fue posible cargar las plantas.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async createPlant(
    input: PlantInput,
  ): Promise<Plant> {
    const payload: PlantInsert = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      timezone: input.timezone.trim(),
      description:
        input.description?.trim() || null,
      active: true,
    };

    const { data, error } = await this.supabase.client
      .from('plants')
      .insert(payload)
      .select(PLANT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const createdPlant = data as Plant;

    this.plants.update(currentPlants =>
      [...currentPlants, createdPlant].sort(
        this.comparePlants,
      ),
    );

    return createdPlant;
  }

  async updatePlant(
    plantId: string,
    input: PlantInput,
  ): Promise<Plant> {
    const payload: PlantUpdate = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      timezone: input.timezone.trim(),
      description:
        input.description?.trim() || null,
    };

    const { data, error } = await this.supabase.client
      .from('plants')
      .update(payload)
      .eq('id', plantId)
      .select(PLANT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const updatedPlant = data as Plant;

    this.plants.update(currentPlants =>
      currentPlants
        .map(plant =>
          plant.id === plantId
            ? updatedPlant
            : plant,
        )
        .sort(this.comparePlants),
    );

    return updatedPlant;
  }

  async setPlantActive(
    plantId: string,
    active: boolean,
  ): Promise<Plant> {
    const { data, error } = await this.supabase.client
      .from('plants')
      .update({
        active,
      })
      .eq('id', plantId)
      .select(PLANT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    const updatedPlant = data as Plant;

    this.plants.update(currentPlants =>
      currentPlants
        .map(plant =>
          plant.id === plantId
            ? updatedPlant
            : plant,
        )
        .sort(this.comparePlants),
    );

    return updatedPlant;
  }

  private readonly comparePlants = (
    firstPlant: Plant,
    secondPlant: Plant,
  ): number => {
    if (firstPlant.active !== secondPlant.active) {
      return firstPlant.active ? -1 : 1;
    }

    return firstPlant.name.localeCompare(
      secondPlant.name,
      'es',
      {
        sensitivity: 'base',
      },
    );
  };
}
