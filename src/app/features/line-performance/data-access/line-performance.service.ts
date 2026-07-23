import {
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  RealtimeChannel,
} from '@supabase/supabase-js';

import {
  Database,
} from '../../../core/types/database.types';

import {
  SupabaseService,
} from '../../../core/services/supabase';

type OverviewArgs =
  Database['public']['Functions']['get_line_performance_overview']['Args'];

type OverviewRow =
  Database['public']['Functions']['get_line_performance_overview']['Returns'][number];

type DailyArgs =
  Database['public']['Functions']['get_line_performance_daily']['Args'];

type DailyRow =
  Database['public']['Functions']['get_line_performance_daily']['Returns'][number];

type DefectsArgs =
  Database['public']['Functions']['get_line_performance_defects']['Args'];

type DefectRow =
  Database['public']['Functions']['get_line_performance_defects']['Returns'][number];

type ByShiftArgs =
  Database['public']['Functions']['get_line_performance_by_shift']['Args'];

type ByShiftRow =
  Database['public']['Functions']['get_line_performance_by_shift']['Returns'][number];

export type LinePerformanceRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface LinePerformanceOverview {
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

  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;

  reportedRecords: number;
  noProductionRecords: number;
  withinTargetRecords: number;
  outsideTargetRecords: number;

  ipdPercentage: number | null;
  configuredTargetPercentage: number | null;
  weightedTargetPercentage: number | null;
  effectiveTargetPercentage: number | null;

  isWithinTarget: boolean | null;
  compliancePercentage: number | null;

  firstRecordDate: string | null;
  lastRecordDate: string | null;
}

export interface LinePerformanceDaily {
  productionDate: string;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  reportedRecords: number;
  noProductionRecords: number;
  withinTargetRecords: number;
  outsideTargetRecords: number;
  ipdPercentage: number | null;
  targetPercentage: number | null;
  isWithinTarget: boolean | null;
}

export interface LinePerformanceDefect {
  defectTypeId: string;
  defectTypeCode: string;
  defectTypeName: string;
  defectCategory: string | null;
  quantity: number;
  recordCount: number;
  percentage: number;
}

export interface LinePerformanceShift {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  displayOrder: number;
  producedQuantity: number;
  defectiveHarnessQuantity: number;
  totalDefects: number;
  reportedRecords: number;
  withinTargetRecords: number;
  outsideTargetRecords: number;
  ipdPercentage: number | null;
  targetPercentage: number | null;
  isWithinTarget: boolean | null;
}

export interface LinePerformanceQuery {
  plantId: string;
  month: string;
  shiftId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LinePerformanceService {
  private readonly supabase =
    inject(SupabaseService);

  readonly overview =
    signal<LinePerformanceOverview[]>([]);

  readonly daily =
    signal<LinePerformanceDaily[]>([]);

  readonly defects =
    signal<LinePerformanceDefect[]>([]);

  readonly byShift =
    signal<LinePerformanceShift[]>([]);

  readonly isLoading =
    signal(false);

  readonly isLoadingDetails =
    signal(false);

  readonly isRefreshing =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly detailsErrorMessage =
    signal('');

  readonly lastLoadedAt =
    signal<Date | null>(null);

  readonly realtimeStatus =
    signal<LinePerformanceRealtimeStatus>(
      'disconnected',
    );

  private realtimeChannel:
    RealtimeChannel | null = null;

  async loadOverview(
    query: LinePerformanceQuery,
    silent = false,
  ): Promise<void> {
    if (
      !query.plantId
      || !query.month
    ) {
      this.overview.set([]);
      return;
    }

    if (silent) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.errorMessage.set('');

    try {
      const payload = {
        plant_id_value:
          query.plantId,

        month_value:
          `${query.month}-01`,

        shift_id_value:
          query.shiftId,
      };

      const { data, error } =
        await this.supabase.client.rpc(
          'get_line_performance_overview',
          payload as OverviewArgs,
        );

      if (error) {
        throw error;
      }

      this.overview.set(
        (data ?? [])
          .map(row => this.mapOverview(row)),
      );

      this.lastLoadedAt.set(new Date());
    } catch (error: unknown) {
      console.error(
        'Unable to load line performance overview.',
        error,
      );

      if (!silent) {
        this.overview.set([]);
      }

      this.errorMessage.set(
        'No fue posible cargar el rendimiento mensual por línea.',
      );
    } finally {
      this.isLoading.set(false);
      this.isRefreshing.set(false);
    }
  }

  async loadDetails(
    lineModelAssignmentId: string,
    query: LinePerformanceQuery,
    silent = false,
  ): Promise<void> {
    if (
      !lineModelAssignmentId
      || !query.month
    ) {
      this.clearDetails();
      return;
    }

    if (!silent) {
      this.isLoadingDetails.set(true);
    }

    this.detailsErrorMessage.set('');

    try {
      const monthValue =
        `${query.month}-01`;

      const dailyPayload = {
        line_model_assignment_id_value:
          lineModelAssignmentId,

        month_value:
          monthValue,

        shift_id_value:
          query.shiftId,
      };

      const defectsPayload = {
        line_model_assignment_id_value:
          lineModelAssignmentId,

        month_value:
          monthValue,

        shift_id_value:
          query.shiftId,

        result_limit_value: 8,
      };

      const byShiftPayload = {
        line_model_assignment_id_value:
          lineModelAssignmentId,

        month_value:
          monthValue,
      };

      const [
        dailyResult,
        defectsResult,
        byShiftResult,
      ] = await Promise.all([
        this.supabase.client.rpc(
          'get_line_performance_daily',
          dailyPayload as DailyArgs,
        ),

        this.supabase.client.rpc(
          'get_line_performance_defects',
          defectsPayload as DefectsArgs,
        ),

        this.supabase.client.rpc(
          'get_line_performance_by_shift',
          byShiftPayload as ByShiftArgs,
        ),
      ]);

      if (dailyResult.error) {
        throw dailyResult.error;
      }

      if (defectsResult.error) {
        throw defectsResult.error;
      }

      if (byShiftResult.error) {
        throw byShiftResult.error;
      }

      this.daily.set(
        (dailyResult.data ?? [])
          .map(row => this.mapDaily(row)),
      );

      this.defects.set(
        (defectsResult.data ?? [])
          .map(row => this.mapDefect(row)),
      );

      this.byShift.set(
        (byShiftResult.data ?? [])
          .map(row => this.mapShift(row)),
      );
    } catch (error: unknown) {
      console.error(
        'Unable to load line performance details.',
        error,
      );

      if (!silent) {
        this.clearDetails();
      }

      this.detailsErrorMessage.set(
        'No fue posible cargar el detalle de la línea seleccionada.',
      );
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  subscribeToRecordChanges(
    onChange: () => void,
  ): void {
    this.unsubscribeFromRecordChanges();

    this.realtimeStatus.set('connecting');

    this.realtimeChannel =
      this.supabase.client
        .channel(
          `line-performance-${crypto.randomUUID()}`,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'daily_ipd_records',
          },
          () => onChange(),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'daily_ipd_defects',
          },
          () => onChange(),
        )
        .subscribe(status => {
          switch (status) {
            case 'SUBSCRIBED':
              this.realtimeStatus.set(
                'connected',
              );
              break;

            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
              this.realtimeStatus.set(
                'error',
              );
              break;

            case 'CLOSED':
              this.realtimeStatus.set(
                'disconnected',
              );
              break;
          }
        });
  }

  unsubscribeFromRecordChanges(): void {
    const channel =
      this.realtimeChannel;

    this.realtimeChannel = null;

    if (channel) {
      void this.supabase.client
        .removeChannel(channel);
    }

    this.realtimeStatus.set(
      'disconnected',
    );
  }

  clearDetails(): void {
    this.daily.set([]);
    this.defects.set([]);
    this.byShift.set([]);
    this.detailsErrorMessage.set('');
  }

  private mapOverview(
    row: OverviewRow,
  ): LinePerformanceOverview {
    return {
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

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      reportedRecords:
        Number(row.reported_records ?? 0),

      noProductionRecords:
        Number(
          row.no_production_records ?? 0,
        ),

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      configuredTargetPercentage:
        this.toNullableNumber(
          row.configured_target_percentage,
        ),

      weightedTargetPercentage:
        this.toNullableNumber(
          row.weighted_target_percentage,
        ),

      effectiveTargetPercentage:
        this.toNullableNumber(
          row.effective_target_percentage,
        ),

      isWithinTarget:
        row.is_within_target,

      compliancePercentage:
        this.toNullableNumber(
          row.compliance_percentage,
        ),

      firstRecordDate:
        row.first_record_date,

      lastRecordDate:
        row.last_record_date,
    };
  }

  private mapDaily(
    row: DailyRow,
  ): LinePerformanceDaily {
    return {
      productionDate:
        row.production_date,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      reportedRecords:
        Number(row.reported_records ?? 0),

      noProductionRecords:
        Number(
          row.no_production_records ?? 0,
        ),

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      targetPercentage:
        this.toNullableNumber(
          row.target_percentage,
        ),

      isWithinTarget:
        row.is_within_target,
    };
  }

  private mapDefect(
    row: DefectRow,
  ): LinePerformanceDefect {
    return {
      defectTypeId:
        row.defect_type_id,

      defectTypeCode:
        row.defect_type_code,

      defectTypeName:
        row.defect_type_name,

      defectCategory:
        row.defect_category,

      quantity:
        Number(row.quantity ?? 0),

      recordCount:
        Number(row.record_count ?? 0),

      percentage:
        Number(row.percentage ?? 0),
    };
  }

  private mapShift(
    row: ByShiftRow,
  ): LinePerformanceShift {
    return {
      shiftId:
        row.shift_id,

      shiftCode:
        row.shift_code,

      shiftName:
        row.shift_name,

      displayOrder:
        row.display_order,

      producedQuantity:
        Number(row.produced_quantity ?? 0),

      defectiveHarnessQuantity:
        Number(
          row.defective_harness_quantity
          ?? 0,
        ),

      totalDefects:
        Number(row.total_defects ?? 0),

      reportedRecords:
        Number(row.reported_records ?? 0),

      withinTargetRecords:
        Number(
          row.within_target_records ?? 0,
        ),

      outsideTargetRecords:
        Number(
          row.outside_target_records ?? 0,
        ),

      ipdPercentage:
        this.toNullableNumber(
          row.ipd_percentage,
        ),

      targetPercentage:
        this.toNullableNumber(
          row.target_percentage,
        ),

      isWithinTarget:
        row.is_within_target,
    };
  }

  private toNullableNumber(
    value: number | string | null,
  ): number | null {
    if (value === null) {
      return null;
    }

    const numberValue =
      Number(value);

    return Number.isFinite(numberValue)
      ? numberValue
      : null;
  }
}
