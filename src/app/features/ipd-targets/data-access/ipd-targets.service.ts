import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { Database } from '../../../core/types/database.types';
import { SupabaseService } from '../../../core/services/supabase';

type IpdTargetOverviewRow =
  Database['public']['Views']['ipd_target_overview']['Row'];

type SaveIpdTargetArguments =
  Database['public']['Functions']['save_ipd_target']['Args'];

type SaveIpdTargetPayload = Omit<
  SaveIpdTargetArguments,
  | 'target_id_value'
  | 'shift_id_value'
  | 'effective_to_value'
> & {
  target_id_value: string | null;
  shift_id_value: string | null;
  effective_to_value: string | null;
};

export interface IpdTarget {
  id: string;

  lineModelAssignmentId: string;

  productionLineId: string;
  productionLineName: string;
  displayOrder: number;

  plantId: string;
  plantCode: string;
  plantName: string;

  productModelId: string;
  productModelName: string;
  modelYear: number | null;

  shiftId: string | null;
  shiftCode: string | null;
  shiftName: string | null;

  targetPercentage: number;

  effectiveFrom: string;
  effectiveTo: string | null;

  active: boolean;
  isGeneralTarget: boolean;
  isCurrent: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface IpdTargetInput {
  targetId: string | null;
  lineModelAssignmentId: string;
  shiftId: string | null;
  targetPercentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class IpdTargetsService {
  private readonly supabase = inject(SupabaseService);

  readonly targets = signal<IpdTarget[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  async loadTargets(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { data, error } = await this.supabase.client
        .from('ipd_target_overview')
        .select('*')
        .order('is_current', {
          ascending: false,
        })
        .order('active', {
          ascending: false,
        })
        .order('plant_code', {
          ascending: true,
        })
        .order('display_order', {
          ascending: true,
        })
        .order('effective_from', {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const targets = (data ?? [])
        .map(row => this.mapTarget(row))
        .filter(
          (
            target,
          ): target is IpdTarget =>
            target !== null,
        );

      this.targets.set(targets);
    } catch (error: unknown) {
      console.error(
        'Unable to load IPD targets.',
        error,
      );

      this.targets.set([]);
      this.errorMessage.set(
        'No fue posible cargar los objetivos IPD.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveTarget(
    input: IpdTargetInput,
  ): Promise<string> {
    const payload: SaveIpdTargetPayload = {
      target_id_value:
        input.targetId,

      line_model_assignment_id_value:
        input.lineModelAssignmentId,

      shift_id_value:
        input.shiftId,

      target_percentage_value:
        input.targetPercentage,

      effective_from_value:
        input.effectiveFrom,

      effective_to_value:
        input.effectiveTo,

      active_value:
        input.active,
    };

    const { data, error } =
      await this.supabase.client.rpc(
        'save_ipd_target',
        payload as SaveIpdTargetArguments,
      );

    if (error) {
      throw error;
    }

    await this.loadTargets();

    return String(data);
  }

  private mapTarget(
    row: IpdTargetOverviewRow,
  ): IpdTarget | null {
    if (
      !row.id
      || !row.line_model_assignment_id
      || !row.production_line_id
      || !row.production_line_name
      || row.display_order === null
      || !row.plant_id
      || !row.plant_code
      || !row.plant_name
      || !row.product_model_id
      || !row.product_model_name
      || row.target_percentage === null
      || !row.effective_from
      || typeof row.active !== 'boolean'
      || typeof row.is_general_target !== 'boolean'
      || typeof row.is_current !== 'boolean'
      || !row.created_at
      || !row.updated_at
    ) {
      return null;
    }

    return {
      id: row.id,

      lineModelAssignmentId:
        row.line_model_assignment_id,

      productionLineId:
        row.production_line_id,

      productionLineName:
        row.production_line_name,

      displayOrder:
        row.display_order,

      plantId:
        row.plant_id,

      plantCode:
        row.plant_code,

      plantName:
        row.plant_name,

      productModelId:
        row.product_model_id,

      productModelName:
        row.product_model_name,

      modelYear:
        row.model_year,

      shiftId:
        row.shift_id,

      shiftCode:
        row.shift_code,

      shiftName:
        row.shift_name,

      targetPercentage:
        Number(row.target_percentage),

      effectiveFrom:
        row.effective_from,

      effectiveTo:
        row.effective_to,

      active:
        row.active,

      isGeneralTarget:
        row.is_general_target,

      isCurrent:
        row.is_current,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    };
  }
}
