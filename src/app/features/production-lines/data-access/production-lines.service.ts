import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { SupabaseService } from '../../../core/services/supabase';
import { Database } from '../../../core/types/database.types';

type ProductionLineOverviewRow =
  Database['public']['Views']['production_line_overview']['Row'];

type SaveProductionLineArguments =
  Database['public']['Functions']['save_production_line']['Args'];

  type SaveProductionLinePayload = Omit<
  SaveProductionLineArguments,
  'line_id_value'
> & {
  line_id_value: string | null;
};

export interface ProductionLine {
  id: string;
  plant_id: string;
  plant_code: string;
  plant_name: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;

  line_model_assignment_id: string | null;
  product_model_id: string | null;
  product_model_name: string | null;
  model_year: number | null;
  model_effective_from: string | null;
  model_effective_to: string | null;
}

export interface ProductionLineInput {
  id: string | null;
  plantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  productModelId: string;
  effectiveFrom: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProductionLinesService {
  private readonly supabase = inject(SupabaseService);

  readonly lines = signal<ProductionLine[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadLines(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } = await this.supabase.client
        .from('production_line_overview')
        .select('*')
        .order('plant_name', {
          ascending: true,
        })
        .order('display_order', {
          ascending: true,
        })
        .order('name', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const mappedLines = (data ?? [])
        .map(row => this.mapLine(row))
        .filter(
          (
            line,
          ): line is ProductionLine =>
            line !== null,
        );

      this.lines.set(mappedLines);
    } catch (error: unknown) {
      console.error(
        'Unable to load production lines.',
        error,
      );

      this.errorMessage.set(
        'No fue posible cargar las líneas de producción.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

async saveLine(
  input: ProductionLineInput,
): Promise<void> {
  const payload: SaveProductionLinePayload = {
    line_id_value: input.id,
    plant_id_value: input.plantId,
    line_name_value: input.name.trim(),
    description_value:
      input.description?.trim() ?? '',
    display_order_value: input.displayOrder,
    product_model_id_value:
      input.productModelId,
    effective_from_value:
      input.effectiveFrom,
  };

  const { error } = await this.supabase.client.rpc(
    'save_production_line',
    payload as SaveProductionLineArguments,
  );

  if (error) {
    throw error;
  }

  await this.loadLines();
}

  async setLineActive(
    lineId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('production_lines')
      .update({
        active,
      })
      .eq('id', lineId)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    await this.loadLines();
  }

  private mapLine(
    row: ProductionLineOverviewRow,
  ): ProductionLine | null {
    if (
      !row.id
      || !row.plant_id
      || !row.plant_code
      || !row.plant_name
      || !row.name
      || row.display_order === null
      || row.active === null
      || !row.created_at
      || !row.updated_at
    ) {
      return null;
    }

    return {
      id: row.id,
      plant_id: row.plant_id,
      plant_code: row.plant_code,
      plant_name: row.plant_name,
      name: row.name,
      description: row.description,
      display_order: row.display_order,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,

      line_model_assignment_id:
        row.line_model_assignment_id,

      product_model_id:
        row.product_model_id,

      product_model_name:
        row.product_model_name,

      model_year:
        row.model_year,

      model_effective_from:
        row.model_effective_from,

      model_effective_to:
        row.model_effective_to,
    };
  }
}
