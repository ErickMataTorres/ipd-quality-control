import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase';
import { Database } from '../../../core/types/database.types';

type SourceLocationMappingOverviewRow =
  Database['public']['Views']['source_location_mapping_overview']['Row'];

type SourceLocationMappingUpdate =
  Database['public']['Tables']['source_location_mappings']['Update'];

export interface SourceLocationMapping {
  id: string;
  sourceCode: string;

  plantId: string | null;
  plantCode: string | null;
  plantName: string | null;

  displayName: string | null;
  notes: string | null;

  active: boolean;
  employeeCount: number;

  createdAt: string;
  updatedAt: string;
}

export interface SourceLocationMappingInput {
  plantId: string | null;
  displayName: string | null;
  notes: string | null;
  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SourceLocationMappingsService {
  private readonly supabase = inject(SupabaseService);

  readonly mappings =
    signal<SourceLocationMapping[]>([]);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadMappings(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } =
        await this.supabase.client
          .from(
            'source_location_mapping_overview',
          )
          .select('*')
          .order('active', {
            ascending: false,
          })
          .order('source_code', {
            ascending: true,
          });

      if (error) {
        throw error;
      }

      const mappings = (data ?? [])
        .map(row => this.mapMapping(row))
        .filter(
          (
            mapping,
          ): mapping is SourceLocationMapping =>
            mapping !== null,
        );

      this.mappings.set(mappings);
    } catch (error: unknown) {
      console.error(
        'Unable to load source location mappings.',
        error,
      );

      this.mappings.set([]);

      this.errorMessage.set(
        'No fue posible cargar las equivalencias de localidades.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateMapping(
    mappingId: string,
    input: SourceLocationMappingInput,
  ): Promise<void> {
    const payload: SourceLocationMappingUpdate = {
      plant_id: input.plantId,

      display_name:
        input.displayName?.trim() || null,

      notes:
        input.notes?.trim() || null,

      active: input.active,
    };

    const { error } =
      await this.supabase.client
        .from('source_location_mappings')
        .update(payload)
        .eq('id', mappingId)
        .select('id')
        .single();

    if (error) {
      throw error;
    }

    await this.loadMappings();
  }

  async setMappingActive(
    mappingId: string,
    active: boolean,
  ): Promise<void> {
    const { error } =
      await this.supabase.client
        .from('source_location_mappings')
        .update({
          active,
        })
        .eq('id', mappingId)
        .select('id')
        .single();

    if (error) {
      throw error;
    }

    await this.loadMappings();
  }

  private mapMapping(
    row: SourceLocationMappingOverviewRow,
  ): SourceLocationMapping | null {
    if (
      !row.id
      || !row.source_code
      || typeof row.active !== 'boolean'
      || !row.created_at
      || !row.updated_at
    ) {
      return null;
    }

    return {
      id: row.id,
      sourceCode: row.source_code,

      plantId: row.plant_id,
      plantCode: row.plant_code,
      plantName: row.plant_name,

      displayName: row.display_name,
      notes: row.notes,

      active: row.active,

      employeeCount: Number(
        row.employee_count ?? 0,
      ),

      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
